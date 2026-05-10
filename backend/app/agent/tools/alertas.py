"""Herramientas de cursos y alertas para el agente.

Permiten al agente listar los cursos disponibles (para identificar a cuál
asociar una alerta) y crear una alerta con severidad y observaciones.
"""

from __future__ import annotations

from langchain_core.tools import tool
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Alert, Course

VALID_SEVERITIES = {"low", "medium", "high"}


@tool
def listar_cursos() -> dict:
    """Lista los cursos disponibles con id, nombre y profesor.

    Útil para que el agente identifique a qué curso asociar una alerta
    cuando el lector menciona el curso por nombre.
    """
    with SessionLocal() as db:
        rows = db.execute(select(Course)).scalars().all()
        return {
            "courses": [
                {
                    "id": c.id,
                    "name": c.name,
                    "teacher_id": c.teacher_id,
                }
                for c in rows
            ]
        }


@tool
def crear_alerta(
    course_id: int,
    severity: str,
    observations: list[str],
) -> dict:
    """Crea una alerta para un curso.

    Args:
        course_id: id del curso (usa `listar_cursos` si no lo conoces).
        severity: 'low', 'medium' o 'high'.
        observations: lista de observaciones (frases breves) que motivan la
            alerta. Al menos una.
    """
    sev = severity.strip().lower()
    if sev not in VALID_SEVERITIES:
        return {
            "error": f"severity inválida: {severity!r}. Usa low, medium o high."
        }
    obs = [o.strip() for o in (observations or []) if o and o.strip()]
    if not obs:
        return {"error": "Debes incluir al menos una observación."}
    with SessionLocal() as db:
        course = db.get(Course, course_id)
        if course is None:
            return {"error": f"Curso {course_id} no existe."}
        alert = Alert(course_id=course_id, severity=sev, observations=obs)
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return {
            "ok": True,
            "alert": {
                "id": alert.id,
                "course_id": alert.course_id,
                "severity": alert.severity,
                "observations": list(alert.observations or []),
            },
        }


ALERTAS_TOOLS = [listar_cursos, crear_alerta]
