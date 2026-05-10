"""Seed script for the demo: 1 teacher, 1 course (Quinto Básico), 30 students.

Run from the backend directory:
    DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app \\
      uv run python -m scripts.seed_demo

Idempotent: re-running with the same teacher email is a no-op.
"""

import json
from datetime import date, timedelta
from pathlib import Path

from app.auth import hash_password
from app.db import SessionLocal
from app.models import (
    ClassLearningRecord,
    Course,
    PlanAnual,
    PlanAnualItem,
    Student,
    Teacher,
)

DEMO_PLAN_ANUAL_PATH = Path(__file__).with_name("demo_plan_anual.json")

TEACHER_NAME = "Ana Pérez"
TEACHER_EMAIL = "ana@demo.cl"
TEACHER_PASSWORD = "123"
COURSES = [
    {
        "name": "5to A - Matemática",
        "class_days": ["monday", "wednesday", "thursday"],
        "block_number": 2,
    },
    {
        "name": "5to B - Matemática",
        "class_days": ["tuesday", "thursday", "friday"],
        "block_number": 3,
    },
    {
        "name": "5to C - Matemática",
        "class_days": ["monday", "wednesday", "friday"],
        "block_number": 5,
    },
]

STUDENT_NAMES = [
    "Sofía Martínez",
    "Mateo González",
    "Valentina Rojas",
    "Benjamín Soto",
    "Isidora Fuentes",
    "Joaquín Muñoz",
    "Antonia Vargas",
    "Vicente Castro",
    "Florencia Reyes",
    "Tomás Silva",
    "Catalina Herrera",
    "Maximiliano Pizarro",
    "Emilia Araya",
    "Agustín Bravo",
    "Trinidad Espinoza",
    "Lucas Navarro",
    "Renata Sepúlveda",
    "Diego Cortés",
    "Amanda Riquelme",
    "Martín Gallardo",
    "Josefa Tapia",
    "Sebastián Pino",
    "Magdalena Salinas",
    "Cristóbal Lagos",
    "Javiera Cáceres",
    "Nicolás Ortega",
    "Constanza Morales",
    "Bastián Carrasco",
    "Fernanda Vega",
    "Ignacio Henríquez",
]

WEEKDAY_BY_NAME = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def estimate_class_dates_for_year(class_days: list[str], year: int) -> list[date]:
    start = date(year, 3, 1)
    end = date(year, 12, 15)
    target_weekdays = {
        WEEKDAY_BY_NAME[day] for day in class_days if day in WEEKDAY_BY_NAME
    }
    if not target_weekdays:
        return []

    class_dates: list[date] = []
    current = start
    while current <= end:
        if current.weekday() in target_weekdays:
            class_dates.append(current)
        current += timedelta(days=1)
    return class_dates


def main() -> None:
    assert len(STUDENT_NAMES) == 30, "expected 30 student names"
    assert len(set(STUDENT_NAMES)) == 30, "student names must be unique"
    school_year = date.today().year

    with SessionLocal() as db:
        teacher = db.query(Teacher).filter_by(email=TEACHER_EMAIL).one_or_none()
        if teacher is not None:
            print(
                f"Teacher {TEACHER_EMAIL} already exists (id={teacher.id}); skipping."
            )
            return

        teacher = Teacher(
            name=TEACHER_NAME,
            email=TEACHER_EMAIL,
            password_hash=hash_password(TEACHER_PASSWORD),
        )
        teacher.courses = [
            Course(
                name=c["name"],
                class_days=c["class_days"],
                block_number=c["block_number"],
                learning_records=[
                    ClassLearningRecord(
                        class_date=class_date,
                        registered=False,
                        oa_numbers=None,
                        observations=None,
                    )
                    for class_date in estimate_class_dates_for_year(
                        c["class_days"], school_year
                    )
                ],
                students=[Student(name=n) for n in STUDENT_NAMES] if i == 0 else [],
            )
            for i, c in enumerate(COURSES)
        ]
        db.add(teacher)
        db.flush()  # populate teacher.id for the plan FK below
        plan_data = json.loads(DEMO_PLAN_ANUAL_PATH.read_text(encoding="utf-8"))
        plan = PlanAnual(
            teacher_id=teacher.id,
            name=plan_data["name"],
            asignatura=plan_data.get("asignatura"),
            curso=plan_data.get("curso"),
            anio=plan_data.get("anio"),
            docente=plan_data.get("docente"),
            items=[
                PlanAnualItem(
                    ordinal=it["ordinal"],
                    mes=it.get("mes"),
                    unidad=it.get("unidad"),
                    oa_codes=list(it.get("oa_codes") or []),
                    objetivo=it.get("objetivo") or "",
                )
                for it in plan_data["items"]
            ],
        )
        db.add(plan)
        db.commit()
        db.refresh(teacher)
        db.refresh(plan)
        print(
            f"Seeded teacher {teacher.email} (id={teacher.id}) with "
            f"{len(teacher.courses)} courses: "
            f"{', '.join(c.name for c in teacher.courses)}. "
            f"Pre-created {sum(len(c.learning_records) for c in teacher.courses)} "
            f"class learning records for {school_year}. "
            f"Seeded plan anual '{plan.name}' (id={plan.id}) with "
            f"{len(plan.items)} items."
        )


if __name__ == "__main__":
    main()
