"""Structured extraction for uploaded test PDFs."""

from __future__ import annotations

import re
import tempfile
from typing import Literal

from langchain_anthropic import ChatAnthropic
from pydantic import BaseModel, Field

from app.config import settings
from app.worksheets.parser import parse_pdf


class AssessmentQuestionDraft(BaseModel):
    ordinal: int = Field(description="Número visible de la pregunta, 1-based.")
    score_key: str = Field(
        description="Clave canónica de resultados para la pregunta, ej. 'P1'."
    )
    prompt: str = Field(description="Enunciado literal de la pregunta.")
    kind: Literal["open", "multiple_choice"] = Field(
        "open",
        description="Tipo de pregunta según el formato visible en la prueba.",
    )
    oa_codes: list[str] = Field(
        default_factory=list,
        description="OAs evaluados por la pregunta, en formato OA4, OA15, etc.",
    )
    max_points: float | None = Field(
        default=None,
        description="Puntaje máximo visible de la pregunta si la prueba lo declara.",
    )


class AssessmentDraft(BaseModel):
    title: str | None = Field(default=None, description="Título o nombre de la prueba.")
    asignatura: str | None = Field(default=None)
    nivel: str | None = Field(default=None)
    questions: list[AssessmentQuestionDraft] = Field(default_factory=list)


SYSTEM = """Eres un extractor estricto de pruebas escolares chilenas de Matemática
5° básico.

Recibes el texto plano completo de una prueba PDF y devuelves JSON estricto
según el schema.

Reglas:
- Extrae cada pregunta evaluable como una entrada independiente, en orden.
- `ordinal` es el número visible de la pregunta. Si no aparece claro, usa el
  orden secuencial 1, 2, 3...
- `score_key` debe quedar en formato `P1`, `P2`, etc. y debe corresponder al
  mismo ordinal.
- `oa_codes` debe listar los OA que la pregunta evalúa. Usa formato `OA4`,
  `OA15`, sin espacios. Si la prueba no declara OA explícitos, infiérelos a
  partir del enunciado y deja solo los que sean plausibles.
- `max_points` solo si el puntaje aparece visible junto a la pregunta o se
  puede deducir de forma directa. Si no, devuelve null.
- No inventes preguntas que no existan y no agrupes varias preguntas en una sola.
"""


def _normalize_oa(code: str) -> str | None:
    match = re.search(r"OA\s*0*(\d{1,2})", code, re.IGNORECASE)
    if not match:
        return None
    return f"OA{int(match.group(1))}"


def extract_assessment_from_pdf(
    pdf_bytes: bytes, *, filename: str | None = None, model: str | None = None
) -> AssessmentDraft:
    """Parse the PDF into raw text, then extract per-question OA structure."""
    with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        tmp.flush()
        parsed = parse_pdf(tmp.name)

    llm = ChatAnthropic(
        model=model or settings.agent_model,
        api_key=settings.anthropic_api_key,
    ).with_structured_output(AssessmentDraft)
    result: AssessmentDraft = llm.invoke(  # type: ignore[assignment]
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": parsed.full_text},
        ]
    )

    for question in result.questions:
        question.score_key = f"P{question.ordinal}"
        normalized = [_normalize_oa(code) for code in question.oa_codes]
        question.oa_codes = [code for code in normalized if code]

    if filename and not result.title:
        result.title = filename
    return result
