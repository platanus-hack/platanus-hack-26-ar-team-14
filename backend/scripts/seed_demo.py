"""Seed script for the Bitácora demo.

Run from the backend directory:
    DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app \
      uv run python -m scripts.seed_demo
"""

import json
from datetime import date, timedelta
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
REGISTERED_RECORDS_CUTOFF = date(SCHOOL_YEAR, 5, 13)

MATH_5_PLAN_ITEMS = [
    {
        "mes": "Marzo",
        "unidad": None,
        "oa_codes": [],
        "objetivo": "Repaso general contenidos año anterior",
    },
    {
        "mes": "Marzo",
        "unidad": "Unidad 1",
        "oa_codes": ["OA1"],
        "objetivo": "OA 1 : Representar y describir números de hasta más de 6 dígitos y menores que 1 000 millones: › identificando el valor posicional de los dígitos › componiendo y descomponiendo números naturales en forma estándar y expandida › aproximando cantidades › comparando y ordenando números naturales en este ámbito numérico › dando ejemplos de estos números naturales en contextos reales.",
    },
    {
        "mes": "Marzo",
        "unidad": "Unidad 1",
        "oa_codes": ["OA2"],
        "objetivo": "OA 2: Aplicar estrategias de cálculo mental para la multiplicación: › anexar ceros cuando se multiplica por un múltiplo de 10 › doblar y dividir por 2 en forma repetida › usando las propiedades conmutativa, asociativa y distributiva",
    },
    {
        "mes": "Abril",
        "unidad": "Unidad 1",
        "oa_codes": ["OA3"],
        "objetivo": "OA 3: Demostrar que comprende la multiplicación de 2 dígitos por 2 dígitos: › estimando productos › aplicando estrategias de cálculo mental › usando la propiedad distributiva de la adición respecto de la multiplicación › resolviendo problemas rutinarios y no rutinarios, aplicando el algoritmo",
    },
    {
        "mes": "Abril",
        "unidad": "Unidad 1",
        "oa_codes": ["OA4"],
        "objetivo": "OA 4: Demostrar que comprende la división con dividendos de tres dígitos y divisores de un dígito: › interpretando el resto › resolviendo problemas rutinarios y no rutinarios que impliquen divisiones",
    },
    {
        "mes": "Abril",
        "unidad": "Unidad 1",
        "oa_codes": ["OA5"],
        "objetivo": "OA 5 : Realizar cálculos que involucren las cuatro operaciones con expresiones numéricas, aplicando las reglas relativas a paréntesis y la prevalencia de la multiplicación y la división por sobre la adición y la sustracción cuando corresponda",
    },
    {
        "mes": "Mayo",
        "unidad": "Unidad 1",
        "oa_codes": ["OA6"],
        "objetivo": "OA 6: Resolver problemas rutinarios y no rutinarios que involucren las cuatro operaciones y combinaciones de ellas: › que incluyan situaciones con dinero › usando la calculadora y el computador en ámbitos numéricos superiores al 10 000",
    },
    {
        "mes": "Mayo",
        "unidad": "Unidad 1",
        "oa_codes": ["OA14"],
        "objetivo": "OA 14: Descubrir alguna regla que explique una sucesión dada y que permita hacer predicciones.",
    },
    {
        "mes": "Mayo",
        "unidad": "Unidad 1",
        "oa_codes": ["OA15"],
        "objetivo": "OA 15: Resolver problemas, usando ecuaciones de un paso que involucren adiciones y sustracciones, en forma pictórica y simbólica.",
    },
    {
        "mes": "Junio",
        "unidad": "Unidad 2",
        "oa_codes": ["OA16"],
        "objetivo": "OA 16: Identificar y dibujar puntos en el primer cuadrante del plano cartesiano, dadas sus coordenadas en números naturales",
    },
    {
        "mes": "Junio",
        "unidad": "Unidad 2",
        "oa_codes": ["OA17"],
        "objetivo": "OA 17: Describir y dar ejemplos de aristas y caras de figuras 3D, y lados de figuras 2D: › que son paralelos › que se interceptan › que son perpendiculares",
    },
    {
        "mes": "Junio",
        "unidad": "Unidad 2",
        "oa_codes": ["OA18"],
        "objetivo": "OA 18: Demostrar que comprende el concepto de congruencia, usando la traslación, la reflexión y la rotación en cuadrículas.",
    },
    {
        "mes": "Julio",
        "unidad": "Unidad 2",
        "oa_codes": ["OA19"],
        "objetivo": "OA 19: Medir longitudes con unidades estandarizadas (m, cm, mm) en el contexto de la resolución de problemas.",
    },
    {
        "mes": "Julio",
        "unidad": "Unidad 2",
        "oa_codes": ["OA20"],
        "objetivo": "OA 20: Realizar transformaciones entre unidades de medidas de longitud (km a m, m a cm, cm a mm y viceversa), usando software educativo.",
    },
    {
        "mes": "Julio",
        "unidad": "Unidad 2",
        "oa_codes": ["OA21"],
        "objetivo": "OA 21: Diseñar y construir diferentes rectángulos, dados el perímetro o el área o ambos, y sacar conclusiones.",
    },
    {
        "mes": "Agosto",
        "unidad": "Unidad 2",
        "oa_codes": ["OA22"],
        "objetivo": "OA 22: Calcular áreas de triángulos, de paralelogramos y de trapecios, y estimar áreas de figuras irregulares aplicando las estrategias: › conteo de cuadrículas › comparación con el área de un rectángulo › completando figuras por traslación",
    },
    {
        "mes": "Septiembre",
        "unidad": "Unidad 3",
        "oa_codes": ["OA7"],
        "objetivo": "OA 7: Demostrar que comprende las fracciones propias: › representándolas de manera concreta, pictórica y simbólica › creando grupos de fracciones equivalentes – simplificando y ampliando– de manera concreta, pictórica, simbólica, de forma manual y/o con software educativo › comparando fracciones propias con igual y distinto denominador de manera concreta, pictórica y simbólica",
    },
    {
        "mes": "Septiembre",
        "unidad": "Unidad 3",
        "oa_codes": ["OA8"],
        "objetivo": "OA 8: Demostrar que comprende las fracciones impropias de uso común de denominadores 2, 3, 4, 5, 6, 8, 10, 12 y los números mixtos asociados: › usando material concreto y pictórico para representarlas, de manera manual y/o usando software educativo › identificando y determinando equivalencias entre fracciones impropias y números mixtos › representando estas fracciones y estos números mixtos en la recta numérica.",
    },
    {
        "mes": "Septiembre",
        "unidad": "Unidad 3",
        "oa_codes": ["OA9"],
        "objetivo": "OA 9: Resolver adiciones y sustracciones con fracciones propias con denominadores menores o iguales a 12: › de manera pictórica y simbólica › amplificando o simplificando.",
    },
    {
        "mes": "Septiembre",
        "unidad": "Unidad 3",
        "oa_codes": ["OA10"],
        "objetivo": "OA 10: Determinar el decimal que corresponde a fracciones con denominador 2, 4, 5 y 10.",
    },
    {
        "mes": "Octubre",
        "unidad": "Unidad 3",
        "oa_codes": ["OA11"],
        "objetivo": "OA 11: Comparar y ordenar decimales hasta la milésima.",
    },
    {
        "mes": "Octubre",
        "unidad": "Unidad 3",
        "oa_codes": ["OA12"],
        "objetivo": "OA 12: Resolver adiciones y sustracciones de decimales, empleando el valor posicional hasta la milésima.",
    },
    {
        "mes": "Octubre",
        "unidad": "Unidad 3",
        "oa_codes": ["OA13"],
        "objetivo": "OA 13: Resolver problemas rutinarios y no rutinarios, aplicando adiciones y sustracciones de fracciones propias o decimales hasta la milésima.",
    },
    {
        "mes": "Noviembre",
        "unidad": "Unidad 4",
        "oa_codes": ["OA26"],
        "objetivo": "OA 26: Leer, interpretar y completar tablas, gráficos de barra simple y gráficos de línea, y comunicar sus conclusiones.",
    },
    {
        "mes": "Noviembre",
        "unidad": "Unidad 4",
        "oa_codes": ["OA23"],
        "objetivo": "OA 23: Calcular el promedio de datos e interpretarlo en su contexto.",
    },
    {
        "mes": "Noviembre",
        "unidad": "Unidad 4",
        "oa_codes": ["OA24"],
        "objetivo": "OA 24: Describir la posibilidad de ocurrencia de un evento de acuerdo con un experimento aleatorio, empleando los términos seguros – posible – poco posible – imposible.",
    },
    {
        "mes": "Noviembre",
        "unidad": "Unidad 4",
        "oa_codes": ["OA25"],
        "objetivo": "OA 25: Comparar probabilidades de distintos eventos sin calcularlas.",
    },
    {
        "mes": "Noviembre",
        "unidad": "Unidad 4",
        "oa_codes": ["OA27"],
        "objetivo": "OA 27: Utilizar diagramas de tallo y hojas para representar datos provenientes de muestras aleatorias.",
    },
]


def _clone_plan_items(items: list[dict]) -> list[dict]:
    return [
        {
            "mes": item["mes"],
            "unidad": item["unidad"],
            "oa_codes": list(item["oa_codes"]),
            "objetivo": item["objetivo"],
        }
        for item in items
    ]


def _make_math_course_seed(
    section: str, class_days: list[str], block_number: int
) -> dict:
    return {
        "name": f"Matemática - 5° Básico {section}",
        "class_days": class_days,
        "block_number": block_number,
        "plan": {
            "name": f"Plan anual Matemática 5° Básico {section}",
            "asignatura": "Matemática",
            "curso": f"5° Básico {section}",
            "anio": 2025,
            "docente": "Héctor González Gaete",
            "items": _clone_plan_items(MATH_5_PLAN_ITEMS),
        },
    }


COURSE_SEEDS = [
    _make_math_course_seed("A", ["monday", "wednesday", "friday"], 1),
    _make_math_course_seed("B", ["monday", "tuesday", "thursday"], 2),
    _make_math_course_seed("C", ["tuesday", "wednesday", "friday"], 4),
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


def _recorded_oas_for_demo_date(class_date: date) -> list[str]:
    """Hand-authored OA progression matching the hardcoded annual plan.

    March focuses on OA1-OA2, April advances through OA3-OA5, and early May
    starts OA6 before introducing OA14. We keep this deliberately simple and
    explicit so the seeded demo reads like a teacher progressing through the
    plan rather than sampling random OAs.
    """
    if class_date.month == 3:
        if class_date.day <= 10:
            return ["OA1"]
        if class_date.day <= 20:
            return ["OA1", "OA2"]
        return ["OA2"]

    if class_date.month == 4:
        if class_date.day <= 7:
            return ["OA2", "OA3"]
        if class_date.day <= 14:
            return ["OA3"]
        if class_date.day <= 21:
            return ["OA3", "OA4"]
        if class_date.day <= 28:
            return ["OA4", "OA5"]
        return ["OA5"]

    if class_date.month == 5:
        if class_date.day <= 6:
            return ["OA5", "OA6"]
        if class_date.day <= 10:
            return ["OA6"]
        return ["OA6", "OA14"]

    return []


def _build_learning_records(seed: dict, cutoff: date) -> list[ClassLearningRecord]:
    """Build ClassLearningRecord rows for one course.

    Dates strictly before `cutoff` are seeded as already registered with a
    simple hand-authored OA progression from the hardcoded March-May annual
    plan.
    Dates ≥ cutoff stay pending so the dashboard's "libro de clases" section
    has work to show.
    """
    records: list[ClassLearningRecord] = []
    for class_date in estimate_class_dates_for_year(seed["class_days"], SCHOOL_YEAR):
        if class_date < cutoff:
            records.append(
                ClassLearningRecord(
                    class_date=class_date,
                    registered=True,
                    oa_numbers=_recorded_oas_for_demo_date(class_date),
                    observations=None,
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
        "guide_name": "Matemática-5°C-GP05B",
        "display_name": "Guía Pedagógica 05B · OA5",
        "kind": "guia",
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


def _reset_demo_teacher_data(db: Session, teacher: Teacher) -> None:
    existing_courses = db.query(Course).filter_by(teacher_id=teacher.id).all()
    for course in existing_courses:
        db.delete(course)

    existing_plans = db.query(PlanAnual).filter_by(teacher_id=teacher.id).all()
    for plan in existing_plans:
        db.delete(plan)

    db.flush()


def main() -> None:
    assert len(STUDENT_NAMES) == 30, "expected 30 student names"
    assert len(set(STUDENT_NAMES)) == 30, "student names must be unique"

    # Demo libro de clases starts with every class before May 13 already recorded.
    cutoff = REGISTERED_RECORDS_CUTOFF

    with SessionLocal() as db:
        teacher = db.query(Teacher).filter_by(email=TEACHER_EMAIL).one_or_none()
        if teacher is not None:
            print(
                f"Teacher {TEACHER_EMAIL} already exists (id={teacher.id}); "
                "refreshing demo courses and plans."
            )
            _reset_demo_teacher_data(db, teacher)
        else:
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


if __name__ == "__main__":
    main()
