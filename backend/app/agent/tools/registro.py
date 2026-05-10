"""Herramienta de registro de clase para el agente.

El agente conoce el `record_id` porque la URL `/libro-de-clases/{id}` lo
inyecta en la conversación. Cuando identifica con alta confianza qué OAs
trabajó el docente, llama esta herramienta para marcar el registro como
completado.
"""

from __future__ import annotations

from langchain_core.tools import tool

from app.db import SessionLocal
from app.models import ClassLearningRecord


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


REGISTRO_TOOLS = [registrar_clase]
