"""One-shot extraction of math guides under docs/cde/ to seed artifacts.

Run once (manually) when guides change:

    DATABASE_URL=... uv run python -m scripts.extract_cde_guides

It writes one JSON per unique-content PDF plus per-question PNG images into
``scripts/seed_data/cde/``. ``seed_demo.py`` then loads those artifacts —
no LLM call at seed time.

Idempotent: existing JSON files for an unchanged source_hash are left alone.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from app.worksheets.extractor import extract_bank
from app.worksheets.parser import parse_pdf

CDE_DIR = Path(__file__).resolve().parents[1] / "docs" / "cde"
OUT_DIR = Path(__file__).resolve().parent / "seed_data" / "cde"
IMG_ROOT = OUT_DIR / "images"


def _is_math_guide(path: Path) -> bool:
    name = path.name.lower()
    if path.suffix.lower() != ".pdf":
        return False
    return name.startswith("matemática") or name.startswith("guía-de-quinto")


def _unique_pdfs(directory: Path) -> list[tuple[Path, bytes, str]]:
    """One (path, bytes, sha256) per content hash, sorted by filename."""
    seen: dict[str, tuple[Path, bytes, str]] = {}
    for p in sorted(directory.iterdir(), key=lambda x: x.name):
        if not _is_math_guide(p):
            continue
        data = p.read_bytes()
        h = hashlib.sha256(data).hexdigest()
        seen.setdefault(h, (p, data, h))
    return list(seen.values())


def _process(path: Path, data: bytes, source_hash: str) -> None:
    json_path = OUT_DIR / f"{path.stem}.json"
    if json_path.exists():
        existing = json.loads(json_path.read_text(encoding="utf-8"))
        if existing.get("source_hash") == source_hash:
            print(f"  • {path.name}: unchanged, skip.")
            return

    print(f"  • {path.name}: parsing…")
    tmp = Path("/tmp") / f"extract-{source_hash}.pdf"
    tmp.write_bytes(data)
    try:
        parsed = parse_pdf(tmp)
    finally:
        tmp.unlink(missing_ok=True)

    image_by_marker = {im.marker: im for im in parsed.images}
    print(f"    parsed {parsed.page_count} pages, {len(parsed.images)} images.")

    print("    extracting questions via LLM…")
    bank = extract_bank(parsed.full_text, valid_markers=set(image_by_marker.keys()))
    print(f"    got {len(bank.questions)} questions.")

    img_subdir = IMG_ROOT / path.stem
    img_subdir.mkdir(parents=True, exist_ok=True)
    questions_out: list[dict] = []
    for q in bank.questions:
        marker = q.image_marker if q.image_marker in image_by_marker else None
        image_file: str | None = None
        image_width: int | None = None
        image_height: int | None = None
        if marker is not None:
            img = image_by_marker[marker]
            image_file = f"{path.stem}/{marker}.png"
            (img_subdir / f"{marker}.png").write_bytes(img.png_bytes)
            image_width = img.width
            image_height = img.height
        questions_out.append(
            {
                "prompt": q.prompt,
                "answer": q.answer,
                "kind": q.kind,
                "alternatives": (
                    [a.model_dump() for a in q.alternatives]
                    if q.kind == "multiple_choice" and q.alternatives
                    else None
                ),
                "correct_alternative": (
                    q.correct_alternative if q.kind == "multiple_choice" else None
                ),
                "image_file": image_file,
                "image_width": image_width,
                "image_height": image_height,
            }
        )

    payload = {
        "source_file": path.name,
        "source_hash": source_hash,
        "asignatura": bank.asignatura,
        "nivel": bank.nivel,
        "oa_code": bank.oa_code,
        "habilidad": bank.habilidad,
        "contenido": bank.contenido,
        "questions": questions_out,
    }
    json_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"    wrote {json_path.relative_to(OUT_DIR.parent.parent)}.")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    IMG_ROOT.mkdir(parents=True, exist_ok=True)
    pdfs = _unique_pdfs(CDE_DIR)
    print(f"Found {len(pdfs)} unique math PDFs in {CDE_DIR}.")
    for path, data, h in pdfs:
        _process(path, data, h)
    print("Done.")


if __name__ == "__main__":
    main()
