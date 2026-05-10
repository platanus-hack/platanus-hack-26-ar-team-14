"""Herramienta de registro de clase para el agente.

El agente conoce el `record_id` porque la URL `/libro-de-clases/{id}` lo
inyecta en la conversación. Cuando identifica con alta confianza qué OAs
trabajó el docente, llama esta herramienta para marcar el registro como
completado.
"""

from __future__ import annotations

from langchain_core.tools import tool
from sqlalchemy import select

from app.db import SessionLocal
from app.models import ClassLearningRecord, Guia


@tool
def registrar_clase(
    record_id: int,
    oa_codes: list[str],
    observaciones: str | None = None,
) -> dict:
    """Marca el registro de una clase como completado con los OAs trabajados.

    Úsalo solo cuando la correspondencia con el plan/OAs es clara. Si la
    descripción del docente es ambigua o vaga, primero pregúntale cuál OA
    corresponde antes de llamar esta herramienta.

    Args:
        record_id: id del registro de clase (lo entrega la URL al agente).
        oa_codes: códigos OA cubiertos en la clase, ej. ["OA8", "OA9"].
        observaciones: síntesis breve (1-2 frases) de lo que el docente
            describió. None si no hay observaciones relevantes.
    """
    with SessionLocal() as db:
        record = db.get(ClassLearningRecord, record_id)
        if record is None:
            return {"error": f"Registro {record_id} no existe."}
        if not oa_codes:
            return {"error": "Tienes que indicar al menos un OA."}
        record.oa_numbers = list(oa_codes)
        record.observations = (observaciones or "").strip() or None
        record.registered = True
        db.commit()
        db.refresh(record)
        return {
            "ok": True,
            "record_id": record.id,
            "oa_numbers": list(record.oa_numbers or []),
            "observations": record.observations,
            "registered": record.registered,
        }


def _oa_sort_key(code: str) -> tuple[int, int, str]:
    digits = "".join(ch for ch in code if ch.isdigit())
    return (0, int(digits), code) if digits else (1, 0, code)


@tool
def buscar_guia(query: str) -> dict:
    """Busca guías por coincidencia parcial en el nombre y devuelve sus OAs.

    Úsala cuando el docente menciona una guía por nombre o código (ej.
    "GP04", "PF-02", "guía de fracciones") para verificar qué OAs cubren
    sus preguntas antes de registrar la clase. La coincidencia es
    case-insensitive y por substring; normaliza guiones y espacios para
    tolerar variantes ("PF02" matchea "PF-02" y "PF 02").

    Args:
        query: fragmento del nombre de la guía.

    Returns:
        `matches`: lista de guías con `id`, `name`, `oa_codes` (orden por
        número OA) y `question_count`. Lista vacía si no hay coincidencias.
    """
    needle = "".join(ch for ch in (query or "").lower() if ch.isalnum())
    if not needle:
        return {"error": "query vacía."}
    with SessionLocal() as db:
        rows = db.execute(select(Guia)).scalars().all()
        matches = []
        for g in rows:
            haystack = "".join(ch for ch in (g.name or "").lower() if ch.isalnum())
            if needle not in haystack:
                continue
            seen: set[str] = set()
            codes: list[str] = []
            for item in g.items:
                code = item.question.oa_code if item.question else None
                if code and code not in seen:
                    seen.add(code)
                    codes.append(code)
            matches.append(
                {
                    "id": g.id,
                    "name": g.name,
                    "oa_codes": sorted(codes, key=_oa_sort_key),
                    "question_count": len(g.items),
                }
            )
        return {"matches": matches}


REGISTRO_TOOLS = [registrar_clase, buscar_guia]
