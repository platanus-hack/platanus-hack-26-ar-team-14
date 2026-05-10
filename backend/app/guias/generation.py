"""Guide generation from curriculum context and weak OA signals."""

from __future__ import annotations

from typing import Literal

from langchain_anthropic import ChatAnthropic
from pydantic import BaseModel, Field, model_validator

from app.config import settings


class GeneratedQuestionDraft(BaseModel):
    kind: Literal["open", "multiple_choice"] = Field(default="open")
    prompt: str
    alternatives: list[dict[str, str]] = Field(default_factory=list)
    correct_alternative: str | None = None
    answer: str | None = None
    oa_code: str
    habilidad: str | None = None
    contenido: str | None = None
    source_note: str | None = None

    @model_validator(mode="after")
    def validate_question_shape(self) -> "GeneratedQuestionDraft":
        if self.kind == "multiple_choice":
            valid_alternatives = [
                alt
                for alt in self.alternatives
                if str(alt.get("label", "")).strip()
                and str(alt.get("text", "")).strip()
            ]
            valid_labels = {
                str(alt.get("label", "")).strip() for alt in valid_alternatives
            }
            if len(valid_alternatives) != 4:
                raise ValueError(
                    "Las preguntas multiple_choice deben traer 4 alternativas no vacías."
                )
            if self.correct_alternative not in valid_labels:
                raise ValueError(
                    "Las preguntas multiple_choice deben marcar una alternativa correcta válida."
                )
        elif not (self.answer or "").strip():
            raise ValueError("Las preguntas abiertas deben traer respuesta esperada.")
        return self


class GeneratedGuideDraft(BaseModel):
    name: str | None = None
    questions: list[GeneratedQuestionDraft] = Field(default_factory=list)


SYSTEM = """Eres un diseñador de guías de refuerzo para Matemática 5° básico.

Devuelves solo JSON estructurado.

Reglas:
- La guía refuerza un OA puntual o un conjunto pequeño de OA relacionados.
- Crea entre 4 y 8 preguntas.
- Empieza más simple y luego sube a aplicación.
- Si usas selección múltiple, incluye alternativas y la correcta.
- Si usas pregunta abierta, pon `answer` breve.
- `source_note` explica en una línea por qué la pregunta ayuda a cerrar la brecha.
- No menciones tablas internas ni detalles técnicos.
"""


def generate_remediation_guide(
    *,
    oa_codes: list[str],
    weak_metrics: list[dict],
    plan_context: str,
    suggested_name: str,
) -> GeneratedGuideDraft:
    model = ChatAnthropic(
        model=settings.agent_model,
        api_key=settings.anthropic_api_key,
    ).with_structured_output(GeneratedGuideDraft)
    user_prompt = "\n".join(
        [
            f"Nombre sugerido: {suggested_name}",
            f"OA objetivo: {', '.join(oa_codes)}",
            f"Métricas débiles: {weak_metrics}",
            f"Contexto del plan: {plan_context}",
            "Genera una guía breve de refuerzo lista para editar.",
        ]
    )
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user_prompt},
    ]
    try:
        draft: GeneratedGuideDraft = model.invoke(messages)  # type: ignore[assignment]
    except Exception:
        retry_prompt = "\n".join(
            [
                user_prompt,
                "Corrección obligatoria: si una pregunta es `multiple_choice`, devuelve exactamente 4 alternativas no vacías con labels A, B, C y D, y `correct_alternative` debe ser una de esas letras.",
                "Si no puedes cumplir eso, usa `kind: open` con `answer` breve.",
            ]
        )
        draft = model.invoke(  # type: ignore[assignment]
            [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": retry_prompt},
            ]
        )
    if not draft.name:
        draft.name = suggested_name
    return draft
