"""Parse a worksheet PDF into raw text + cropped image PNGs.

pdfplumber for text + image bbox positions; pypdfium2 to render those
bboxes as PNG (works for JPEG / Flate / JPX without us decoding filters).

Each image gets a unique marker like ``IMG_p2_1``. The full text passed
to the LLM has the markers appended at the end of their page so the
structured-output extractor can attach images to the right question.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium

RENDER_SCALE = 2.0
MIN_IMG_PT_AREA = 400.0  # skip tiny decorations / bullets


@dataclass(frozen=True)
class ParsedImage:
    page_number: int
    ordinal: int
    marker: str
    width: int
    height: int
    png_bytes: bytes


@dataclass(frozen=True)
class ParsedPage:
    page_number: int
    text: str  # ends with a `[Imágenes en página: ...]` line if any.


@dataclass(frozen=True)
class ParsedWorksheet:
    page_count: int
    pages: list[ParsedPage]
    images: list[ParsedImage]

    @property
    def full_text(self) -> str:
        return "\n\n".join(
            f"=== Página {p.page_number} ===\n{p.text}" for p in self.pages
        )


def parse_pdf(path: str | Path) -> ParsedWorksheet:
    pages: list[ParsedPage] = []
    images: list[ParsedImage] = []

    pdf_doc = pdfium.PdfDocument(str(path))
    try:
        with pdfplumber.open(str(path)) as pdf:
            for idx, page in enumerate(pdf.pages):
                page_no = idx + 1
                text = (page.extract_text() or "").strip()
                page_imgs = _extract_page_images(page, pdf_doc[idx], page_no)
                if page_imgs:
                    refs = " ".join(f"[[{im.marker}]]" for im in page_imgs)
                    text = f"{text}\n[Imágenes en página: {refs}]"
                pages.append(ParsedPage(page_number=page_no, text=text))
                images.extend(page_imgs)
    finally:
        pdf_doc.close()

    return ParsedWorksheet(page_count=len(pages), pages=pages, images=images)


def _extract_page_images(
    page: pdfplumber.page.Page, fpage: pdfium.PdfPage, page_no: int
) -> list[ParsedImage]:
    out: list[ParsedImage] = []
    page_w, page_h = page.width, page.height
    ordinal = 0
    for img in page.images:
        x0, x1 = float(img["x0"]), float(img["x1"])
        top, bottom = float(img["top"]), float(img["bottom"])
        if (x1 - x0) * (bottom - top) < MIN_IMG_PT_AREA:
            continue
        ordinal += 1
        png = _render_bbox(
            fpage,
            x0=x0,
            top=top,
            x1=x1,
            bottom=bottom,
            page_width=page_w,
            page_height=page_h,
        )
        w, h = _png_size(png)
        out.append(
            ParsedImage(
                page_number=page_no,
                ordinal=ordinal,
                marker=f"IMG_p{page_no}_{ordinal}",
                width=w,
                height=h,
                png_bytes=png,
            )
        )
    return out


def _render_bbox(
    fpage: pdfium.PdfPage,
    *,
    x0: float,
    top: float,
    x1: float,
    bottom: float,
    page_width: float,
    page_height: float,
) -> bytes:
    bitmap = fpage.render(
        scale=RENDER_SCALE,
        crop=(
            max(0.0, x0),
            max(0.0, page_height - bottom),
            max(0.0, page_width - x1),
            max(0.0, top),
        ),
    )
    buf = io.BytesIO()
    bitmap.to_pil().save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _png_size(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return (0, 0)
    return (
        int.from_bytes(data[16:20], "big"),
        int.from_bytes(data[20:24], "big"),
    )
