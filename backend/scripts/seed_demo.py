"""Seed script for the demo: 1 teacher, 1 course (Quinto Básico), 30 students.

Run from the backend directory:
    DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app \\
      uv run python -m scripts.seed_demo

Idempotent: re-running with the same teacher email is a no-op.
"""

import json
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.db import SessionLocal
from app.models import (
    ClassLearningRecord,
    Course,
    Guia,
    GuiaItem,
    PlanAnual,
    PlanAnualItem,
    Question,
    Student,
    Teacher,
)

DEMO_PLAN_ANUAL_PATH = Path(__file__).with_name("demo_plan_anual.json")
CDE_SEED_DIR = Path(__file__).resolve().parent / "seed_data" / "cde"
CDE_IMG_DIR = CDE_SEED_DIR / "images"

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


def _load_guide_artifact(json_path: Path) -> dict:
    return json.loads(json_path.read_text(encoding="utf-8"))


def _question_rows_from_artifact(artifact: dict) -> list[Question]:
    """Build Question ORM rows from a pre-extracted seed artifact.

    Image bytes are loaded from ``scripts/seed_data/cde/images/`` so the row
    matches what ``ingest_pdf`` would have produced at runtime.
    """
    rows: list[Question] = []
    for q in artifact["questions"]:
        image_data: bytes | None = None
        image_mime: str | None = None
        if q.get("image_file"):
            image_data = (CDE_IMG_DIR / q["image_file"]).read_bytes()
            image_mime = "image/png"
        rows.append(
            Question(
                prompt=q["prompt"],
                answer=q.get("answer"),
                kind=q["kind"],
                alternatives=q.get("alternatives"),
                correct_alternative=q.get("correct_alternative"),
                asignatura=artifact.get("asignatura"),
                nivel=artifact.get("nivel"),
                oa_code=artifact.get("oa_code"),
                habilidad=artifact.get("habilidad"),
                contenido=artifact.get("contenido"),
                source_file=artifact.get("source_file"),
                source_hash=artifact.get("source_hash"),
                image_data=image_data,
                image_mime=image_mime,
                image_width=q.get("image_width"),
                image_height=q.get("image_height"),
            )
        )
    return rows


def _seed_guides_for_teacher(db: Session, teacher: Teacher) -> None:
    """Load pre-extracted guides from seed_data/cde and attach one Guia per PDF.

    Idempotent: a Guia with the same (teacher_id, name) is left untouched, and
    Question rows for an already-ingested ``source_hash`` are reused.
    """
    if not CDE_SEED_DIR.exists():
        print(
            f"seed_data dir missing at {CDE_SEED_DIR}; "
            "run `uv run python -m scripts.extract_cde_guides` first."
        )
        return

    artifacts = sorted(CDE_SEED_DIR.glob("*.json"))
    print(f"Found {len(artifacts)} pre-extracted guide artifacts in {CDE_SEED_DIR}.")

    created = 0
    for json_path in artifacts:
        artifact = _load_guide_artifact(json_path)
        guia_name = json_path.stem
        if (
            db.query(Guia)
            .filter_by(teacher_id=teacher.id, name=guia_name)
            .one_or_none()
            is not None
        ):
            print(f"  • Guia '{guia_name}' already exists; skip.")
            continue

        source_hash = artifact.get("source_hash")
        existing_qs = (
            db.query(Question).filter_by(source_hash=source_hash).all()
            if source_hash
            else []
        )
        if existing_qs:
            questions = existing_qs
            print(f"  • Reusing {len(questions)} existing questions for '{guia_name}'.")
        else:
            questions = _question_rows_from_artifact(artifact)
            for q in questions:
                db.add(q)
            db.flush()
            print(f"  • Inserted {len(questions)} questions for '{guia_name}'.")

        guia = Guia(
            teacher_id=teacher.id,
            name=guia_name,
            items=[
                GuiaItem(question_id=q.id, ordinal=i)
                for i, q in enumerate(questions)
            ],
        )
        db.add(guia)
        db.commit()
        db.refresh(guia)
        created += 1
        print(f"    ✓ Guia '{guia_name}' (id={guia.id}) — {len(questions)} preguntas.")

    print(f"Guides seeded: {created} new, {len(artifacts) - created} pre-existing.")


def main() -> None:
    assert len(STUDENT_NAMES) == 30, "expected 30 student names"
    assert len(set(STUDENT_NAMES)) == 30, "student names must be unique"
    school_year = date.today().year

    with SessionLocal() as db:
        teacher = db.query(Teacher).filter_by(email=TEACHER_EMAIL).one_or_none()
        if teacher is not None:
            print(
                f"Teacher {TEACHER_EMAIL} already exists (id={teacher.id}); "
                f"reusing for guide seeding."
            )
            _seed_guides_for_teacher(db, teacher)
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
        _seed_guides_for_teacher(db, teacher)


if __name__ == "__main__":
    main()
