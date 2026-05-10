"""Seed script for the Bitácora demo.

Run from the backend directory:
    DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app \
      uv run python -m scripts.seed_demo
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

CDE_SEED_DIR = Path(__file__).resolve().parent / "seed_data" / "cde"
CDE_IMG_DIR = CDE_SEED_DIR / "images"

TEACHER_NAME = "Ana Pérez"
TEACHER_EMAIL = "ana@demo.cl"
TEACHER_PASSWORD = "123"
SCHOOL_YEAR = date.today().year

COURSE_SEEDS = [
    {
        "name": "Lenguaje y Comunicación - 5° Básico A",
        "class_days": ["monday", "wednesday", "friday"],
        "block_number": 1,
        "plan": {
            "name": "Plan anual Lenguaje 5° Básico A",
            "asignatura": "Lenguaje y Comunicación",
            "curso": "5° Básico A",
            "items": [
                {
                    "mes": "Marzo",
                    "unidad": "Unidad 1",
                    "oa_codes": ["OA1", "OA2"],
                    "objetivo": "Comprender textos narrativos y aplicar estrategias iniciales de lectura.",
                },
                {
                    "mes": "Abril",
                    "unidad": "Unidad 2",
                    "oa_codes": ["OA4"],
                    "objetivo": "Analizar aspectos relevantes de narraciones leídas y producir evidencia escrita.",
                },
                {
                    "mes": "Mayo",
                    "unidad": "Unidad 2",
                    "oa_codes": ["OA7"],
                    "objetivo": "Evaluar información explícita e implícita del texto antes de la próxima evaluación.",
                },
            ],
        },
    },
    {
        "name": "Ciencias Naturales - 6° Básico B",
        "class_days": ["tuesday", "wednesday", "friday"],
        "block_number": 3,
        "plan": {
            "name": "Plan anual Ciencias 6° Básico B",
            "asignatura": "Ciencias Naturales",
            "curso": "6° Básico B",
            "items": [
                {
                    "mes": "Marzo",
                    "unidad": "Unidad 1",
                    "oa_codes": ["OA3"],
                    "objetivo": "Explicar relaciones entre organismos y ambiente con evidencia experimental.",
                },
                {
                    "mes": "Abril",
                    "unidad": "Unidad 1",
                    "oa_codes": ["OA6", "OA7"],
                    "objetivo": "Analizar cambios en cadenas alimentarias y factores humanos sobre el equilibrio ecosistémico.",
                },
                {
                    "mes": "Mayo",
                    "unidad": "Unidad 2",
                    "oa_codes": ["OA8"],
                    "objetivo": "Describir efectos de fuerzas en objetos cotidianos y vincularlos con actividades de laboratorio.",
                },
            ],
        },
    },
    {
        "name": "Historia - 4° Básico A",
        "class_days": ["monday", "thursday", "friday"],
        "block_number": 7,
        "plan": {
            "name": "Plan anual Historia 4° Básico A",
            "asignatura": "Historia",
            "curso": "4° Básico A",
            "items": [
                {
                    "mes": "Marzo",
                    "unidad": "Unidad 1",
                    "oa_codes": ["OA4", "OA5"],
                    "objetivo": "Reconocer elementos de la vida cotidiana colonial y compararlos con la actualidad.",
                },
                {
                    "mes": "Abril",
                    "unidad": "Unidad 2",
                    "oa_codes": ["OA8"],
                    "objetivo": "Analizar cambios en las formas de organización social durante la colonia.",
                },
                {
                    "mes": "Mayo",
                    "unidad": "Unidad 2",
                    "oa_codes": ["OA9"],
                    "objetivo": "Relacionar fuentes y guías pedagógicas con procesos históricos del período colonial.",
                },
            ],
        },
    },
    {
        "name": "Matemática - 5° Básico A",
        "class_days": ["tuesday", "thursday"],
        "block_number": 5,
        "plan": {
            "name": "Plan anual Matemática 5° Básico A",
            "asignatura": "Matemática",
            "curso": "5° Básico A",
            "items": [
                {
                    "mes": "Marzo",
                    "unidad": "Unidad 1",
                    "oa_codes": ["OA1", "OA3"],
                    "objetivo": "Resolver problemas de valor posicional y operaciones básicas en contextos cotidianos.",
                },
                {
                    "mes": "Abril",
                    "unidad": "Unidad 2",
                    "oa_codes": ["OA5"],
                    "objetivo": "Aplicar estrategias de cálculo mental y estimación para situaciones de aula.",
                },
                {
                    "mes": "Mayo",
                    "unidad": "Unidad 3",
                    "oa_codes": ["OA7"],
                    "objetivo": "Representar datos y comunicar resultados mediante tablas y gráficos simples.",
                },
            ],
        },
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
    """Build Question ORM rows from a pre-extracted seed artifact."""
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
    """Load pre-extracted guides from seed_data/cde and attach them to the teacher."""
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
        existing_guide = (
            db.query(Guia).filter_by(teacher_id=teacher.id, name=guia_name).one_or_none()
        )
        if existing_guide is not None:
            print(f"  - Guia '{guia_name}' already exists; skip.")
            continue

        source_hash = artifact.get("source_hash")
        existing_questions = (
            db.query(Question).filter_by(source_hash=source_hash).all()
            if source_hash
            else []
        )
        if existing_questions:
            questions = existing_questions
            print(f"  - Reusing {len(questions)} existing questions for '{guia_name}'.")
        else:
            questions = _question_rows_from_artifact(artifact)
            for question in questions:
                db.add(question)
            db.flush()
            print(f"  - Inserted {len(questions)} questions for '{guia_name}'.")

        guia = Guia(
            teacher_id=teacher.id,
            name=guia_name,
            items=[
                GuiaItem(question_id=question.id, ordinal=ordinal)
                for ordinal, question in enumerate(questions)
            ],
        )
        db.add(guia)
        db.commit()
        db.refresh(guia)
        created += 1
        print(f"    seeded guia '{guia_name}' (id={guia.id}) with {len(questions)} items.")

    print(f"Guides seeded: {created} new, {len(artifacts) - created} pre-existing.")


def build_plan(seed: dict, teacher_id: int) -> PlanAnual:
    plan = PlanAnual(
        teacher_id=teacher_id,
        name=seed["plan"]["name"],
        asignatura=seed["plan"]["asignatura"],
        curso=seed["plan"]["curso"],
        anio=SCHOOL_YEAR,
        docente=TEACHER_NAME,
    )
    for ordinal, item in enumerate(seed["plan"]["items"]):
        plan.items.append(
            PlanAnualItem(
                ordinal=ordinal,
                mes=item["mes"],
                unidad=item["unidad"],
                oa_codes=list(item["oa_codes"]),
                objetivo=item["objetivo"],
            )
        )
    return plan


def main() -> None:
    assert len(STUDENT_NAMES) == 30, "expected 30 student names"
    assert len(set(STUDENT_NAMES)) == 30, "student names must be unique"

    with SessionLocal() as db:
        teacher = db.query(Teacher).filter_by(email=TEACHER_EMAIL).one_or_none()
        if teacher is not None:
            print(
                f"Teacher {TEACHER_EMAIL} already exists (id={teacher.id}); "
                "reusing for guide seeding."
            )
            _seed_guides_for_teacher(db, teacher)
            return

        teacher = Teacher(
            name=TEACHER_NAME,
            email=TEACHER_EMAIL,
            password_hash=hash_password(TEACHER_PASSWORD),
        )
        db.add(teacher)
        db.flush()

        courses: list[Course] = []
        for index, seed in enumerate(COURSE_SEEDS):
            plan = build_plan(seed, teacher.id)
            course = Course(
                name=seed["name"],
                teacher_id=teacher.id,
                class_days=list(seed["class_days"]),
                block_number=seed["block_number"],
                plan_anual=plan,
                learning_records=[
                    ClassLearningRecord(
                        class_date=class_date,
                        registered=False,
                        oa_numbers=None,
                        observations=None,
                    )
                    for class_date in estimate_class_dates_for_year(
                        seed["class_days"], SCHOOL_YEAR
                    )
                ],
                students=[Student(name=name) for name in STUDENT_NAMES]
                if index == 0
                else [],
            )
            courses.append(course)

        teacher.courses = courses
        db.commit()
        db.refresh(teacher)
        print(
            f"Seeded teacher {teacher.email} (id={teacher.id}) with "
            f"{len(teacher.courses)} courses and {len(COURSE_SEEDS)} linked plans. "
            f"Pre-created {sum(len(c.learning_records) for c in teacher.courses)} "
            f"class learning records for {SCHOOL_YEAR}."
        )
        _seed_guides_for_teacher(db, teacher)


if __name__ == "__main__":
    main()
