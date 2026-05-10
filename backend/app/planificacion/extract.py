"""Extract a structured Planificación Anual from a teacher-uploaded PDF.

Strategy: try multimodal PDF first (better fidelity for tables and
diagrams). If that fails — typically because the PDF is too long for
Anthropic's context window — fall back to plain-text extraction with
pdfplumber.
"""

from __future__ import annotations

import base64
import io
import logging

import pdfplumber
import pypdfium2 as pdfium
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from pypdf import PdfReader, PdfWriter

from app.config import settings

logger = logging.getLogger(__name__)

# Anthropic rejects PDFs > 100 pages outright. We trim before sending.
ANTHROPIC_PDF_PAGE_LIMIT = 100
# Hard cap on chars for the text fallback (~50k tokens).
MAX_TEXT_CHARS = 150_000
# When falling back to images (scanned PDFs), only the first N pages.
# Each page ≈ 1.5–3k tokens at 144 DPI; 20 pages stays well under context.
IMAGE_FALLBACK_MAX_PAGES = 20
IMAGE_FALLBACK_DPI = 144


class PlanAnualDraftItem(BaseModel):
    """Una fila extraída del plan anual."""

    mes: str | None = Field(
        default=None,
        description=(
            "Mes en español ('Marzo', 'Abril', ...) si la fila lo declara o "
            "si se hereda de la fila previa de la misma unidad. None solo "
            "cuando el plan no asigna ningún mes a esta fila."
        ),
    )
    unidad: str | None = Field(
        default=None,
        description=(
            "Etiqueta de unidad tal como aparece en el plan, ej. 'Unidad 1'. "
            "None para filas sueltas (repaso, diagnóstico, etc.)."
        ),
    )
    oa_codes: list[str] = Field(
        default_factory=list,
        description=(
            "Códigos OA mencionados en la fila, normalizados a 'OA1', 'OA15', "
            "etc. (sin espacios ni puntuación). Lista vacía si la fila no "
            "declara ningún OA, por ejemplo una fila de repaso general."
        ),
    )
    objetivo: str = Field(
        description=(
            "Texto completo del objetivo de aprendizaje tal como aparece en "
            "el plan, sin resumir."
        ),
    )
    cantidad_clases: int | None = Field(
        default=None,
        description=(
            "Número de clases asignadas a esta fila si el plan lo declara "
            "explícitamente; en planes que solo dicen 'Marzo' déjalo en None."
        ),
    )


class PlanAnualDraft(BaseModel):
    """Plan anual extraído de un PDF."""

    asignatura: str | None = Field(
        default=None, description="Asignatura del plan, ej. 'Matemática'."
    )
    curso: str | None = Field(
        default=None, description="Curso, ej. '5° básico' o '5 año básico'."
    )
    anio: int | None = Field(default=None, description="Año del plan, ej. 2025.")
    docente: str | None = Field(
        default=None, description="Nombre completo del docente si aparece."
    )
    items: list[PlanAnualDraftItem] = Field(
        description="Filas del plan, en el orden en que aparecen.",
    )


_EXTRACT_PROMPT_PDF = """Eres un extractor estricto. Te entrego una
planificación anual de Matemática chilena en PDF. Devuelve el plan como
datos estructurados, sin inventar nada.

Reglas:
- Cada fila visible del cuerpo de la tabla del plan es un item, en orden.
- 'oa_codes' contiene los OA que la fila declara (ej. 'OA1', 'OA15'),
  normalizados a 'OAn' sin espacios. Lista vacía si la fila no declara OA.
- 'objetivo' es el texto completo de la celda de objetivo de aprendizaje.
- 'mes' es el mes literal de la fila ('Marzo'); si la celda viene vacía
  pero la unidad continúa del mes anterior, hereda ese mes. Si no se
  puede deducir, devuelve null.
- 'unidad' es la etiqueta tal cual ('Unidad 1'); si viene vacía pero la
  fila pertenece a la misma unidad anterior, repítela.
- 'cantidad_clases' solo si el plan lo declara explícitamente.
- Cabecera: extrae asignatura, curso, año y docente si están.

Si el PDF incluye material adicional (Programa de Estudio, anexos, guías),
ignóralo y extrae solo el plan anual propiamente tal.

No inventes OAs ni texto. Si un valor no aparece, devuelve null."""


_EXTRACT_PROMPT_TEXT = _EXTRACT_PROMPT_PDF.replace(
    "Te entrego una\nplanificación anual de Matemática chilena en PDF.",
    "Te paso el texto extraído de una planificación anual de Matemática chilena.",
)


def _truncate_pdf(pdf_bytes: bytes, max_pages: int) -> bytes:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if len(reader.pages) <= max_pages:
        return pdf_bytes
    writer = PdfWriter()
    for page in reader.pages[:max_pages]:
        writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _pdf_to_text(pdf_bytes: bytes) -> str:
    chunks: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            txt = (page.extract_text() or "").strip()
            if txt:
                chunks.append(f"--- Página {i} ---\n{txt}")
    return "\n\n".join(chunks).strip()


def _llm(model: str | None) -> ChatAnthropic:
    return ChatAnthropic(
        model=model or settings.agent_model,
        api_key=settings.anthropic_api_key,
    )


def _extract_via_pdf(pdf_bytes: bytes, *, model: str | None) -> PlanAnualDraft:
    pdf_bytes = _truncate_pdf(pdf_bytes, ANTHROPIC_PDF_PAGE_LIMIT)
    b64 = base64.b64encode(pdf_bytes).decode("ascii")
    structured = _llm(model).with_structured_output(PlanAnualDraft)
    message = HumanMessage(
        content=[
            {"type": "text", "text": _EXTRACT_PROMPT_PDF},
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": b64,
                },
            },
        ]
    )
    return structured.invoke([message])


def _extract_via_text(pdf_bytes: bytes, *, model: str | None) -> PlanAnualDraft:
    text = _pdf_to_text(pdf_bytes)
    if not text:
        raise ValueError("PDF sin texto extraíble (probablemente escaneado).")
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS]
    structured = _llm(model).with_structured_output(PlanAnualDraft)
    return structured.invoke(
        [
            ("system", _EXTRACT_PROMPT_TEXT),
            ("human", text),
        ]
    )


def _render_pdf_pages_to_jpegs(
    pdf_bytes: bytes, *, max_pages: int, dpi: int
) -> list[bytes]:
    """Render up to `max_pages` PDF pages to JPEG bytes via pypdfium2."""
    out: list[bytes] = []
    pdf = pdfium.PdfDocument(pdf_bytes)
    try:
        scale = dpi / 72.0
        for page in pdf[:max_pages]:
            bitmap = page.render(scale=scale)
            pil_image = bitmap.to_pil().convert("RGB")
            buf = io.BytesIO()
            pil_image.save(buf, format="JPEG", quality=85)
            out.append(buf.getvalue())
    finally:
        pdf.close()
    return out


def _extract_via_images(pdf_bytes: bytes, *, model: str | None) -> PlanAnualDraft:
    pages = _render_pdf_pages_to_jpegs(
        pdf_bytes,
        max_pages=IMAGE_FALLBACK_MAX_PAGES,
        dpi=IMAGE_FALLBACK_DPI,
    )
    if not pages:
        raise ValueError("El PDF no tiene páginas renderizables.")
    image_blocks = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": base64.b64encode(jpg).decode("ascii"),
            },
        }
        for jpg in pages
    ]
    structured = _llm(model).with_structured_output(PlanAnualDraft)
    message = HumanMessage(
        content=[{"type": "text", "text": _EXTRACT_PROMPT_PDF}, *image_blocks]
    )
    return structured.invoke([message])


def extract_plan_from_pdf(
    pdf_bytes: bytes, *, model: str | None = None
) -> PlanAnualDraft:
    """Extrae la planificación anual.

    Cascada de estrategias:
    1. PDF como `document` block multimodal (mejor fidelidad).
    2. Texto extraído con pdfplumber (rápido y barato).
    3. Páginas renderizadas como imágenes JPEG (PDFs escaneados o sin
       capa de texto).
    """
    try:
        return _extract_via_pdf(pdf_bytes, model=model)
    except Exception as e:  # noqa: BLE001
        logger.warning("PDF document extraction failed: %s", e)

    try:
        return _extract_via_text(pdf_bytes, model=model)
    except Exception as e:  # noqa: BLE001
        logger.warning("Text extraction failed, trying image rendering: %s", e)

    return _extract_via_images(pdf_bytes, model=model)
