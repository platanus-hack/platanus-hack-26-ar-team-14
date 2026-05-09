"""LLM-based extraction of a flat list of questions from a worksheet PDF.

We feed the PDF text (with image markers appended per page) to Claude via
``with_structured_output`` and get back curriculum-tagged questions ready
to drop into the question bank.
"""

from __future__ import annotations

import re
from typing import Literal

from langchain_anthropic import ChatAnthropic
from pydantic import BaseModel, Field

from app.config import settings


class Alternative(BaseModel):
    label: str = Field(description="Letra de la alternativa, p.ej. 'a', 'b', 'c', 'd'.")
    text: str = Field(description="Texto literal de la alternativa.")


class ExtractedQuestion(BaseModel):
    kind: Literal["open", "multiple_choice"] = Field(
        "open",
        description=(
            "'multiple_choice' SOLO si la pregunta presenta alternativas "
            "(a/b/c/d) que son las opciones de respuesta. 'open' si es "
            "desarrollo, completar tabla, problema, etc."
        ),
    )
    prompt: str = Field(
        description=(
            "Enunciado literal de la pregunta. NO incluyas las alternativas "
            "a)/b)/c)/d) acá — esas van en `alternatives`."
        )
    )
    alternatives: list[Alternative] = Field(
        default_factory=list,
        description=(
            "Si kind='multiple_choice', lista todas las alternativas en "
            "orden. Si kind='open', deja la lista vacía."
        ),
    )
    correct_alternative: str | None = Field(
        None,
        description=(
            "Letra de la alternativa correcta (p.ej. 'b') si está indicada "
            "en el documento (clave/solucionario). Si no, null."
        ),
    )
    answer: str | None = Field(
        None,
        description=(
            "Respuesta para preguntas abiertas, solo si aparece en el "
            "documento (pauta). En MC, deja null y usa correct_alternative."
        ),
    )
    image_marker: str | None = Field(
        None,
        description=(
            "ID de la imagen asociada (sin corchetes), p.ej. 'IMG_p2_1'. "
            "null si no tiene imagen."
        ),
    )


class ExtractedBank(BaseModel):
    asignatura: str | None = Field(None, description="P.ej. 'Matemática'.")
    nivel: str | None = Field(None, description="P.ej. '5° básico'.")
    oa_code: str | None = Field(None, description="Código OA, p.ej. 'OA4'.")
    habilidad: str | None = Field(
        None, description="Habilidad principal de la guía (una sola)."
    )
    contenido: str | None = Field(
        None, description="Tema principal, p.ej. 'División de números naturales'."
    )
    questions: list[ExtractedQuestion] = Field(default_factory=list)


SYSTEM = """Eres un asistente que convierte guías escolares chilenas
(Matemática 5° básico, MINEDUC) en un banco de preguntas estructurado.

Recibes el texto plano completo de un PDF (con marcadores de imagen
`[[IMG_pX_N]]` al final de cada página) y devuelves JSON estricto según
el schema.

Reglas:
- Extrae los metadatos curriculares (asignatura, nivel, oa_code,
  habilidad, contenido) UNA sola vez para toda la guía. `oa_code` debe
  quedar en formato "OA4" sin espacios.

- Aplana TODAS las preguntas en una sola lista, sin agrupar por actividad.

- Distingue dos tipos:
  · `multiple_choice`: la pregunta termina con alternativas a)/b)/c)/d)
    que son OPCIONES de respuesta (frases cortas que responden el
    enunciado). Pon SOLO el enunciado en `prompt`, y las opciones en
    `alternatives` con su letra y texto. NO repitas las alternativas en
    el prompt.
  · `open`: la pregunta es de desarrollo, completar tabla, problema,
    cálculo, etc. Las viñetas a), b), c) que aparecen como sub-ejercicios
    distintos (cada una con su propio enunciado/cálculo) son preguntas
    INDEPENDIENTES — crea una entrada `open` por cada una y NO las
    metas en `alternatives`.

- Conserva el texto literal del prompt y de cada alternativa; no resumas.

- Si la guía incluye una pauta/clave: en MC pon la letra en
  `correct_alternative`; en abiertas pon el texto en `answer`.

- Para cada imagen `[[IMG_pX_N]]`, decide a qué pregunta acompaña
  visualmente y pon su ID (sin corchetes) en `image_marker`. Si es
  decorativa (logo, sello del colegio), omítela. Máximo 1 imagen
  por pregunta. Es perfectamente normal que muchas preguntas NO tengan
  imagen — en ese caso deja `image_marker` en null.
"""


def _normalize_oa(code: str | None) -> str | None:
    if not code:
        return None
    m = re.search(r"OA\s*0*(\d{1,2})", code, re.IGNORECASE)
    return f"OA{int(m.group(1))}" if m else None


def extract_bank(
    raw_text: str, *, valid_markers: set[str] | None = None
) -> ExtractedBank:
    """One-shot LLM call → typed list of questions + curriculum tags.

    Single retry on schema-validation failure. Image markers the model
    invents (not in `valid_markers`) are dropped so callers never look
    up a non-existent image.
    """
    base = ChatAnthropic(
        model=settings.agent_model,
        api_key=settings.anthropic_api_key,
    )
    model = base.with_structured_output(ExtractedBank)
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": raw_text},
    ]
    try:
        result: ExtractedBank = model.invoke(messages)  # type: ignore[assignment]
    except Exception:
        result = model.invoke(messages)  # type: ignore[assignment]

    if result.oa_code:
        result.oa_code = _normalize_oa(result.oa_code)

    if valid_markers is not None:
        for q in result.questions:
            if q.image_marker:
                clean = q.image_marker.strip().strip("[]").strip()
                q.image_marker = clean if clean in valid_markers else None
    return result
