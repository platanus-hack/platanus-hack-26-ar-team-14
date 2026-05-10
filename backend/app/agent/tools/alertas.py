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
        return {"error": f"severity inválida: {severity!r}. Usa low, medium o high."}
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


@tool
def listar_alertas_curso(course_id: int) -> dict:
    """Lista las alertas abiertas de un curso, de más reciente a más antigua.

    Útil cuando el lector confirma un ajuste al plan y necesitas identificar
    qué alerta cerrar.
    """
    with SessionLocal() as db:
        course = db.get(Course, course_id)
        if course is None:
            return {"error": f"Curso {course_id} no existe."}
        rows = (
            db.execute(
                select(Alert)
                .where(Alert.course_id == course_id)
                .order_by(Alert.created_at.desc(), Alert.id.desc())
            )
            .scalars()
            .all()
        )
        return {
            "alerts": [
                {
                    "id": a.id,
                    "course_id": a.course_id,
                    "severity": a.severity,
                    "observations": list(a.observations or []),
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in rows
            ]
        }


@tool
def cerrar_alerta(alert_id: int) -> dict:
    """Cierra (elimina) una alerta una vez que la causa que la motivó está resuelta.

    Llama esto cuando aplicaste el ajuste al plan que cierra la brecha
    señalada por la alerta. Usa `listar_alertas_curso` si necesitas ubicar
    el `alert_id` a partir del curso.
    """
    with SessionLocal() as db:
        alert = db.get(Alert, alert_id)
        if alert is None:
            return {"error": f"Alerta {alert_id} no existe."}
        course_id = alert.course_id
        db.delete(alert)
        db.commit()
        return {"ok": True, "closed_alert_id": alert_id, "course_id": course_id}


ALERTAS_TOOLS = [listar_cursos, crear_alerta, listar_alertas_curso, cerrar_alerta]
