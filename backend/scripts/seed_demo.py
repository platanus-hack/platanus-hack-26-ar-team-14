"""Seed script for the Bitácora demo.

Run from the backend directory:
    DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app \
      uv run python -m scripts.seed_demo
"""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.db import SessionLocal, engine
from app.models import (
    Alert,
    ClassLearningRecord,
    Course,
    Guia,
    GuiaItem,
    Material,
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

DEMO_PLAN_JSON = Path(__file__).resolve().parent / "demo_plan_anual.json"


def _load_demo_plan_anual(plan_name: str, curso_label: str) -> dict:
    """Load the long Matemática 5° plan from `demo_plan_anual.json`.

    The JSON is the canonical curricular plan extracted from the official PDF
    (28 items, all OAs of the year). Used as the linked plan for the
    Matemática 5° Básico courses so the agent has a realistic plan to reason
    against.
    """
    data = json.loads(DEMO_PLAN_JSON.read_text(encoding="utf-8"))
    items = sorted(data["items"], key=lambda it: it.get("ordinal", 0))
    return {
        "name": plan_name,
        "asignatura": "Matemática",
        "curso": curso_label,
        "anio": data.get("anio") or SCHOOL_YEAR,
        "docente": data.get("docente") or TEACHER_NAME,
        "items": [
            {
                "mes": it.get("mes"),
                "unidad": it.get("unidad"),
                "oa_codes": list(it.get("oa_codes") or []),
                "objetivo": it.get("objetivo") or "",
            }
            for it in items
        ],
    }


COURSE_SEEDS = [
    {
        "name": "Matemática - 5° Básico B",
        "class_days": ["monday", "wednesday", "friday"],
        "block_number": 1,
        "plan": _load_demo_plan_anual(
            plan_name="Plan anual Matemática 5° Básico B",
            curso_label="5° Básico B",
        ),
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
        "plan": _load_demo_plan_anual(
            plan_name="Plan anual Matemática 5° Básico A",
            curso_label="5° Básico A",
        ),
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

SPANISH_MONTHS_TITLE = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]

# Per-asignatura bank of teacher-voice observations. Past learning records
# rotate through these deterministically, so the demo libro de clases reads as
# realistic without any LLM call. Templates are short (≤ 2 lines clamp in UI).
OBS_TEMPLATES_BY_ASIGNATURA: dict[str, list[str]] = {
    "Ciencias Naturales": [
        "Introducción al concepto con ejemplos cercanos al curso. Activación de conocimientos previos en lluvia de ideas. Tarea: traer imagen relacionada.",
        "Experimento corto en aula con material disponible. Registro de observaciones en cuaderno. Curso entusiasmado. Pendiente: análisis de datos.",
        "Trabajo con láminas y material visual. Clasificación colaborativa en pizarra. Mateo aportó ejemplo concreto del entorno.",
        "Construcción colaborativa de esquema en la pizarra. Buen razonamiento sistémico de varios estudiantes. Tarea: replicar esquema en cuaderno.",
        "Lectura del texto guía en página indicada. Trabajo en parejas con preguntas de comprensión. Bastián hizo pregunta relevante al cierre.",
        "Análisis de datos recopilados en clase anterior. Lectura e interpretación en parejas. Algunos confundieron promedio con suma. Refuerzo focalizado.",
        "Investigación en pequeños grupos sobre subtema asignado. Cada grupo investigó aspecto distinto. Florencia trajo investigación adicional muy completa.",
        "Discusión sobre fenómenos cotidianos relacionados con el contenido. Curso muy participativo. Buena conexión con experiencia personal.",
        "Demostración con material didáctico al inicio de la sesión. Curso fascinado. Ejercicios posteriores en cuaderno.",
        "Documental corto seguido de discusión guiada. Curso atento durante la proyección. Discusión posterior muy rica. Tarea: resumen breve.",
        "Trabajo individual con guía de aplicación. Pasé por los puestos resolviendo dudas. Renata necesita apoyo individual.",
        "Caso de estudio chileno relacionado con el OA. Discusión guiada. Sofía aportó información que enriqueció la sesión.",
        "Ejercicio de clasificación con fichas. Trabajo en parejas. Buen ejercicio de razonamiento taxonómico. Tarea: completar tabla.",
        "Visualización de datos con láminas. Dificultades de algunos estudiantes con escalas. Refuerzo necesario la próxima clase.",
        "Presentaciones de investigaciones grupales. Variedad excelente. Trinidad y Vicente sorprendieron por nivel de detalle.",
        "Cierre de tema con mapa conceptual colaborativo. Buen ejercicio de síntesis. Próxima clase: evaluación corta del contenido.",
    ],
    "Historia": [
        "Activación de conocimientos previos sobre el período. Línea de tiempo en pizarra. Mateo aportó dato sobre origen mapuche de palabras cotidianas.",
        "Análisis de fuente primaria con guía de lectura. Vocabulario antiguo dificultó algunos pasajes. Buen ejercicio de inferencia léxica.",
        "Discusión guiada sobre el contenido. Participación activa. Sofía hizo pregunta importante sobre las desigualdades del sistema.",
        "Trabajo con material visual: láminas de época. Comparamos con vida actual. Florencia destacó por observaciones detalladas.",
        "Mapa conceptual colaborativo en pizarra. Buen ejercicio de síntesis. Renata destacó conexiones interesantes entre conceptos.",
        "Lectura comprensiva con guía estructurada. Trabajo individual posterior. Tres estudiantes confunden conceptos relacionados; refuerzo focalizado.",
        "Investigación sobre tema específico en grupos. Cada grupo investigó aspecto distinto. Tarea: traer ficha de investigación.",
        "Comparación entre épocas o regiones en tabla colaborativa. Catalina propuso comparación adicional muy pertinente.",
        "Análisis de mapa cartográfico del período. Lectura de mapa con preguntas guía. Vicente identificó patrones interesantes en las fundaciones.",
        "Presentaciones grupales breves de investigaciones. Variedad de casos. Trinidad presentó con detalle notable. Buen nivel general.",
        "Reflexión sobre conexiones con el presente. Curso muy involucrado. Tomás aportó comparación con sistema actual; enriqueció la discusión.",
        "Trabajo con conceptos densos de organización social. Requirió varios ejemplos. Tres estudiantes aún confunden términos. Refuerzo necesario.",
        "Visualización de tradiciones que persisten al presente. Catalina trajo receta antigua. Buena conexión con contexto familiar.",
        "Análisis comparativo de fuentes distintas. Concepto de evidencia histórica. Discusión sobre confiabilidad de fuentes.",
        "Cierre de tema con síntesis colaborativa. Mapa de conceptos clave en pizarra. Próxima clase: integramos con tema previo.",
        "Trabajo en parejas sobre fragmento documental. Buena colaboración. Joaquín hizo pregunta teológica interesante.",
    ],
    "Matemática": [
        "Diagnóstico breve sobre conceptos previos. Buen nivel general. Introduje el contenido nuevo con ejemplos contextuales.",
        "Resolución guiada en pizarra paso a paso. Práctica posterior en cuaderno. Mayoría logró replicar con números similares.",
        "Trabajo individual con material concreto. Pasé por los puestos resolviendo dudas. Trinidad sorprendió con cálculo mental.",
        "Cálculo mental en parejas con tarjetas. Buena dinámica colaborativa. Algunos estudiantes con tablas débiles. Refuerzo necesario.",
        "Aplicación del concepto a problema cotidiano. Lectura comprensiva del enunciado. Catalina destacó en interpretación del problema.",
        "Ejercicios graduales en cuaderno. Concentración sostenida. Errores típicos en pasos intermedios. Refuerzo individual con cinco estudiantes.",
        "Demostración paso a paso con ejemplo claro. Anotaciones en cuaderno. Bastián propuso truco mnemotécnico útil.",
        "Refuerzo focalizado con grupo que mostró dificultad. Mejora notable respecto a clase anterior. Sofía y Tomás casi 100%.",
        "Estimación y aproximación como estrategia. Concepto útil pero abstracto. Florencia hizo conexión con compras del supermercado.",
        "Ejercicio de profundización con números más grandes. Tres estudiantes mostraron dificultad. Refuerzo individual.",
        "Lectura de cifras en voz alta. Joaquín leyó número de varios dígitos sin titubear. Práctica posterior en cuaderno.",
        "Comparación y orden con estrategia explícita. Catalina propuso atajo correcto. Tarea: ordenar conjunto similar.",
        "Operaciones combinadas con paréntesis. Concepto difícil. Vicente identificó error en su propio trabajo; buena reflexión.",
        "Problema verbal en grupos pequeños. Lectura comprensiva y traducción a expresión matemática. Mateo y Florencia presentaron solución elegante.",
        "Evaluación corta del contenido. Resultados mixtos: la mayoría logró, algunos requieren refuerzo. Plan focalizado.",
        "Cierre de tema con síntesis grupal. Mapa de procedimientos clave en pizarra. Buen cierre de unidad.",
    ],
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


def _oas_for_class(plan_items: list[dict], month: int, idx: int) -> list[str]:
    """Pick one OA from the plan item that matches the given month (1–12),
    cycling through its `oa_codes` by `idx` so consecutive classes within a
    month touch different OAs when the plan offers more than one."""
    target = SPANISH_MONTHS_TITLE[month - 1]
    item = next((it for it in plan_items if it.get("mes") == target), None)
    if not item or not item.get("oa_codes"):
        return []
    codes = list(item["oa_codes"])
    return [codes[idx % len(codes)]]


def _build_learning_records(seed: dict, cutoff: date) -> list[ClassLearningRecord]:
    """Build ClassLearningRecord rows for one course.

    Past dates (strictly before `cutoff`) are seeded as registered, with OA
    codes drawn from the plan item that matches the class's month and an
    observation rotated from the asignatura's template bank. Dates ≥ cutoff
    stay pending so the dashboard's "libro de clases" section has work to show.
    """
    plan_items = seed["plan"]["items"]
    asignatura = seed["plan"]["asignatura"]
    templates = OBS_TEMPLATES_BY_ASIGNATURA.get(asignatura)
    if not templates:
        templates = OBS_TEMPLATES_BY_ASIGNATURA["Matemática"]

    records: list[ClassLearningRecord] = []
    past_idx = 0
    for class_date in estimate_class_dates_for_year(seed["class_days"], SCHOOL_YEAR):
        if class_date < cutoff:
            oas = _oas_for_class(plan_items, class_date.month, past_idx)
            if asignatura == "Matemática" and class_date.month == 5:
                oas = ["OA4"]
            obs = templates[past_idx % len(templates)]
            past_idx += 1
            if oas:
                records.append(
                    ClassLearningRecord(
                        class_date=class_date,
                        registered=True,
                        oa_numbers=oas,
                        observations=obs,
                    )
                )
                continue
        records.append(
            ClassLearningRecord(
                class_date=class_date,
                registered=False,
                oa_numbers=None,
                observations=None,
            )
        )
    return records


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


# Material docente que se mostrará en la columna "Material docente" del plan
# anualizado para Matemática 5° básico. Cada entrada apunta a una guía CDE
# pre-cargada (por nombre = stem del JSON en seed_data/cde) y se ata a los
# items del plan cuyo `oa_codes` incluya alguno de los OAs en `oa_targets`.
MATERIAL_DOCENTE_SEEDS: list[dict] = [
    {
        "guide_name": "Matemática-5°C-GP-03",
        "display_name": "Guía Pedagógica 03 · OA1",
        "kind": "guia",
        "oa_targets": ["OA1"],
    },
    {
        "guide_name": "MATEMÁTICA-5°C-GP04",
        "display_name": "Guía Pedagógica 04 · OA4",
        "kind": "guia",
        "oa_targets": ["OA4"],
    },
    {
        "guide_name": "Matemática-5°C-PF01",
        "display_name": "Prueba Formativa 01 · OA4",
        "kind": "prueba",
        "oa_targets": ["OA4"],
    },
    {
        "guide_name": "Matemática-5°C-GP05B",
        "display_name": "Guía Pedagógica 05B · OA5",
        "kind": "guia",
        "oa_targets": ["OA5"],
    },
    {
        "guide_name": "Matemática-5°C-PF05A",
        "display_name": "Prueba Formativa 05A · OA5",
        "kind": "prueba",
        "oa_targets": ["OA5"],
    },
    {
        "guide_name": "Matemática-5°C-GP08",
        "display_name": "Guía Pedagógica 08 · OA6",
        "kind": "guia",
        "oa_targets": ["OA6"],
    },
    {
        "guide_name": "MATEMÁTICA-5°C-GP07",
        "display_name": "Guía Pedagógica 07 · OA7",
        "kind": "guia",
        "oa_targets": ["OA7"],
    },
    {
        "guide_name": "Matemática-5°C-GP10",
        "display_name": "Guía Pedagógica 10 · OA14",
        "kind": "guia",
        "oa_targets": ["OA14"],
    },
    {
        "guide_name": "Matemática-5ºC-GP11",
        "display_name": "Guía Pedagógica 11 · OA18",
        "kind": "guia",
        "oa_targets": ["OA18"],
    },
    {
        "guide_name": "Matemática-5°C-GP12",
        "display_name": "Guía Pedagógica 12 · OA19",
        "kind": "guia",
        "oa_targets": ["OA19"],
    },
]


def _seed_plan_materials(db: Session, teacher: Teacher) -> None:
    """Attach demo Material rows to Matemática plan items.

    Para cada guía pre-cargada del docente, crea un `Material` que la apunta y
    lo asigna al primer `PlanAnualItem` (de un plan de Matemática del docente)
    que tenga un OA dentro de `oa_targets`. Si el item ya tiene material, no
    lo sobrescribe — esto deja espacio para variar pruebas vs. guías sobre OAs
    repetidos sin pelearse.
    """
    matematica_plans = [
        c.plan_anual
        for c in teacher.courses
        if c.plan_anual is not None and c.plan_anual.asignatura == "Matemática"
    ]
    if not matematica_plans:
        print("  - No hay plan de Matemática para vincular materiales; skip.")
        return

    attached = 0
    for spec in MATERIAL_DOCENTE_SEEDS:
        guia = (
            db.query(Guia)
            .filter_by(teacher_id=teacher.id, name=spec["guide_name"])
            .one_or_none()
        )
        if guia is None:
            print(f"  - Guía '{spec['guide_name']}' no encontrada; skip material.")
            continue

        oa_targets = set(spec["oa_targets"])
        for plan in matematica_plans:
            # First try: attach to a free item that covers one of the target OAs.
            target_item = next(
                (
                    it
                    for it in plan.items
                    if it.material_id is None
                    and oa_targets.intersection(set(it.oa_codes or []))
                ),
                None,
            )
            # Fallback (mostly for "prueba"): land in the same month as the OA
            # the material targets, even if a different item in that month —
            # pruebas suelen aplicarse al final del mes/unidad.
            if target_item is None:
                target_meses = {
                    it.mes
                    for it in plan.items
                    if oa_targets.intersection(set(it.oa_codes or [])) and it.mes
                }
                target_item = next(
                    (
                        it
                        for it in plan.items
                        if it.material_id is None and it.mes in target_meses
                    ),
                    None,
                )
            if target_item is None:
                continue
            material = Material(
                name=spec["display_name"],
                kind=spec["kind"],
                guia_id=guia.id,
            )
            db.add(material)
            db.flush()
            target_item.material_id = material.id
            attached += 1
    db.commit()
    print(f"Materiales docentes vinculados a items de plan: {attached}.")


# Resultados precargados para algunas pruebas, para que la columna de
# "Resultados" muestre datos en la demo. Solo aplican a materiales kind='prueba'
# ya seedeados arriba (match por `display_name`).
# Solo PF01 viene pre-llenada para que la columna "Resultados" muestre
# datos en frío. PF05A se deja vacía a propósito: el docente la llena en
# vivo subiendo una planilla en el chat (el agente llama a
# `registrar_resultados_prueba`). Es la demo del flujo de upload.
PRUEBA_RESULTADO_SEEDS: list[dict] = [
    {
        "display_name": "Prueba Formativa 01 · OA4",
        "n_alumnos": 28,
        "promedio": 5.4,
        "pct_aprobados": 82.1,
    },
]


def _seed_prueba_resultados(db: Session, teacher: Teacher) -> None:
    """Rellena los campos de resultados en las pruebas listadas en
    `PRUEBA_RESULTADO_SEEDS`. Si una prueba aparece en varios planes del
    docente (5°A y 5°B), todas reciben los mismos datos para la demo.
    """
    matematica_plan_ids = [
        c.plan_anual.id
        for c in teacher.courses
        if c.plan_anual is not None and c.plan_anual.asignatura == "Matemática"
    ]
    if not matematica_plan_ids:
        return

    updated = 0
    for spec in PRUEBA_RESULTADO_SEEDS:
        materials = (
            db.query(Material)
            .filter(
                Material.name == spec["display_name"],
                Material.kind == "prueba",
            )
            .all()
        )
        for material in materials:
            material.n_alumnos = spec["n_alumnos"]
            material.promedio = spec["promedio"]
            material.pct_aprobados = spec["pct_aprobados"]
            material.resultados_uploaded_at = datetime.now(timezone.utc)
            updated += 1
    db.commit()
    print(f"Resultados de pruebas precargados: {updated}.")


ALERT_SEEDS: list[dict] = []


def _seed_alerts(db: Session, teacher: Teacher) -> None:
    """Insert demo alerts for the teacher's courses if missing."""
    courses_by_name = {c.name: c for c in teacher.courses}
    for spec in ALERT_SEEDS:
        course = courses_by_name.get(spec["course_name"])
        if course is None:
            print(f"  - Course '{spec['course_name']}' not found; skip alert seed.")
            continue
        existing = (
            db.query(Alert)
            .filter_by(course_id=course.id, severity=spec["severity"])
            .one_or_none()
        )
        if existing is not None:
            print(
                f"  - Alert {spec['severity']} for '{course.name}' already exists; skip."
            )
            continue
        db.add(
            Alert(
                course_id=course.id,
                severity=spec["severity"],
                observations=list(spec["observations"]),
            )
        )
        print(f"  - Seeded {spec['severity']} alert for '{course.name}'.")


def build_plan(seed: dict, teacher_id: int) -> PlanAnual:
    plan = PlanAnual(
        teacher_id=teacher_id,
        name=seed["plan"]["name"],
        asignatura=seed["plan"]["asignatura"],
        curso=seed["plan"]["curso"],
        anio=seed["plan"].get("anio") or SCHOOL_YEAR,
        docente=seed["plan"].get("docente") or TEACHER_NAME,
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


def _reset_database() -> None:
    """Drop the public schema and re-run alembic upgrade to a clean state.

    Wipes everything including alembic_version, then replays migrations so the
    schema matches HEAD. Safer than `Base.metadata.create_all` because it keeps
    the seed run aligned with the migration history the app boots against.
    """
    print("Dropping public schema…")
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    engine.dispose()
    print("Running alembic upgrade head…")
    backend_root = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_root / "alembic"))
    command.upgrade(cfg, "head")


def main() -> None:
    assert len(STUDENT_NAMES) == 30, "expected 30 student names"
    assert len(set(STUDENT_NAMES)) == 30, "student names must be unique"

    _reset_database()

    # Past records get filled in for any class date strictly before this cutoff.
    # The 2-day buffer keeps the most recent class day pending so the dashboard's
    # "libro de clases" section has something to show.
    cutoff = date.today() - timedelta(days=2)

    with SessionLocal() as db:
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
                learning_records=_build_learning_records(seed, cutoff),
                students=[Student(name=name) for name in STUDENT_NAMES]
                if index == 0
                else [],
            )
            courses.append(course)

        teacher.courses = courses
        db.flush()
        _seed_alerts(db, teacher)
        db.commit()
        db.refresh(teacher)
        registered_count = sum(
            1 for c in teacher.courses for r in c.learning_records if r.registered
        )
        total_records = sum(len(c.learning_records) for c in teacher.courses)
        print(
            f"Seeded teacher {teacher.email} (id={teacher.id}) with "
            f"{len(teacher.courses)} courses and {len(COURSE_SEEDS)} linked plans. "
            f"Pre-created {total_records} class learning records for "
            f"{SCHOOL_YEAR} ({registered_count} registered up to {cutoff}, "
            f"{total_records - registered_count} pending/upcoming)."
        )
        _seed_guides_for_teacher(db, teacher)
        _seed_plan_materials(db, teacher)
        _seed_prueba_resultados(db, teacher)


if __name__ == "__main__":
    main()
