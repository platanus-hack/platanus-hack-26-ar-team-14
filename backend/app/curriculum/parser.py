"""PDF parsers for MINEDUC Bases Curriculares and Programa de Estudio.

Scope: Matemática 5° básico only (the level this hackathon targets).
Both functions return plain dicts so the rest of the pipeline never
touches pdfplumber.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import pdfplumber

# Page ranges discovered empirically (1-indexed PDF pages).
BASES_MATE_5TO_PAGES = (249, 251)
PROGRAMA_UNIDADES = {
    1: (55, 87),
    2: (89, 114),
    3: (117, 140),
    4: (143, 158),
}

# Canonical eje ranges for Matemática 5° básico (from Bases Curriculares).
# Hardcoded because pdfplumber line ordering corrupts the eje column when
# eje labels wrap onto two visual lines next to OA text.
EJE_BY_OA_NUM = {
    **{n: "Números y Operaciones" for n in range(1, 14)},
    **{n: "Patrones y Álgebra" for n in (14, 15)},
    **{n: "Geometría" for n in (16, 17, 18)},
    **{n: "Medición" for n in (19, 20, 21, 22)},
    **{n: "Datos y Probabilidades" for n in range(23, 28)},
}

OA_LINE_RE = re.compile(r"^\s*(\d{1,2})\s+(.+)$")
OA_REF_IN_TEXT = re.compile(r"\bOA\s*(\d{1,2})\b")


@dataclass(frozen=True)
class OA:
    asignatura: str
    nivel: str
    eje: str
    codigo: str  # e.g. "OA1"
    texto: str


@dataclass(frozen=True)
class ProgramaChunk:
    text: str
    unidad: int
    pagina: int
    oa_codes: tuple[str, ...]


def extract_oas_mate_5to(pdf_path: str | Path) -> list[OA]:
    """Parse Bases Curriculares pp. 249-251 → list of 27 OA objects.

    Layout: left-margin eje labels (sometimes wrapped over 2 lines),
    then numbered OAs with bullet sub-items prefixed by "ú" (= •).
    """
    start, end = BASES_MATE_5TO_PAGES
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for pageno in range(start, end + 1):
            text = pdf.pages[pageno - 1].extract_text() or ""
            for raw in text.splitlines():
                line = raw.rstrip()
                if line:
                    lines.append(line)

    oas: list[OA] = []
    buffer: list[str] = []
    current_num: int | None = None

    def flush() -> None:
        nonlocal buffer, current_num
        if current_num is not None and buffer:
            cleaned = " ".join(buffer).replace("ú ", "• ").strip()
            oas.append(
                OA(
                    asignatura="Matemática",
                    nivel="5° básico",
                    eje=EJE_BY_OA_NUM.get(current_num, "Sin eje"),
                    codigo=f"OA{current_num}",
                    texto=cleaned,
                )
            )
        buffer = []
        current_num = None

    skip_exact = {
        "Objetivos de Aprendizaje",
        "Los estudiantes serán capaces de:",
        "Ejes",
    }
    # Eje labels appearing on their own line (skip; eje is assigned by number).
    skip_eje_fragments = {
        "Números y", "Operaciones",
        "Patrones y", "álgebra",
        "Geometría", "Medición",
        "datos y", "Probabilidades",
    }

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped in skip_exact or stripped in skip_eje_fragments:
            continue
        if re.fullmatch(r"\d{1,3}", stripped):
            continue
        if stripped.startswith("Bases Curriculares") or stripped.startswith("Matemática 5"):
            continue

        m = OA_LINE_RE.match(stripped)
        # An OA number line is `<num> <text>` where num is 1-27 and not a bullet.
        if m and not stripped.startswith("ú"):
            num = int(m.group(1))
            if 1 <= num <= 27 and (current_num is None or num == current_num + 1 or num == 1):
                flush()
                current_num = num
                buffer.append(m.group(2))
                continue
        if current_num is not None:
            buffer.append(stripped)

    flush()
    return oas


def extract_programa_chunks(pdf_path: str | Path) -> list[ProgramaChunk]:
    """One chunk per content page of the Programa, tagged with unit + OA refs.

    We deliberately keep chunking coarse (page-level) because the 2-column
    layout makes finer splits unreliable without bbox parsing. Vector search
    on page-sized chunks (~300-700 tokens) works well enough for the demo.
    """
    chunks: list[ProgramaChunk] = []
    with pdfplumber.open(pdf_path) as pdf:
        for unidad, (start, end) in PROGRAMA_UNIDADES.items():
            for pageno in range(start, end + 1):
                text = (pdf.pages[pageno - 1].extract_text() or "").strip()
                if len(text) < 80:  # skip near-empty filler pages
                    continue
                oa_codes = tuple(
                    sorted({f"OA{int(n)}" for n in OA_REF_IN_TEXT.findall(text)})
                )
                chunks.append(
                    ProgramaChunk(
                        text=text,
                        unidad=unidad,
                        pagina=pageno,
                        oa_codes=oa_codes,
                    )
                )
    return chunks
