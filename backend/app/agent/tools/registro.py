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
def buscar_guia(
    query: str | None = None,
    oa_code: str | None = None,
) -> dict:
    """Busca guías por nombre o por OA cubierto.

    Tiene dos usos:
    - Verificación: cuando el docente menciona una guía por nombre o
      código (ej. "GP04", "PF-02"), pasa `query` para confirmar qué OAs
      cubren sus preguntas. La coincidencia es por substring
      alfanumérico, así "PF02" matchea "PF-02" y "PF 02".
    - Recomendación: cuando necesitas proponer una guía existente para
      cerrar una brecha (ej. la próxima clase debería trabajar OA8),
      pasa `oa_code="OA8"` para listar las guías que cubren ese OA.

    Puedes combinar ambos. Sin parámetros devuelve error.

    Returns:
        `matches`: lista de guías con `id`, `name`, `oa_codes` (orden por
        número OA), `question_count` y `editor_url` (`/guias/editor/{id}`,
        listo para enlazar en la respuesta).
    """
    needle = "".join(ch for ch in (query or "").lower() if ch.isalnum()) if query else ""
    oa_target = (oa_code or "").strip().upper() or None
    if not needle and not oa_target:
        return {"error": "Pasa `query`, `oa_code`, o ambos."}
    with SessionLocal() as db:
        rows = db.execute(select(Guia)).scalars().all()
        matches = []
        for g in rows:
            if needle:
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
            if oa_target and oa_target not in seen:
                continue
            matches.append(
                {
                    "id": g.id,
                    "name": g.name,
                    "oa_codes": sorted(codes, key=_oa_sort_key),
                    "question_count": len(g.items),
                    "editor_url": f"/guias/editor/{g.id}",
                }
            )
        return {"matches": matches}


REGISTRO_TOOLS = [registrar_clase, buscar_guia]
