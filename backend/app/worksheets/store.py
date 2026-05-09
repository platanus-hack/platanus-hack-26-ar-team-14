"""Ingest a worksheet PDF into the flat question bank."""

from __future__ import annotations

import hashlib
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Question
from app.worksheets.extractor import extract_bank
from app.worksheets.parser import parse_pdf


def ingest_pdf(
    db: Session,
    *,
    file_name: str,
    file_bytes: bytes,
) -> list[Question]:
    """Parse + extract + persist questions. Idempotent on (source_hash):
    re-uploading the same PDF returns the previously-stored rows untouched.
    """
    source_hash = hashlib.sha256(file_bytes).hexdigest()
    existing = (
        db.query(Question).filter(Question.source_hash == source_hash).all()
    )
    if existing:
        return existing

    tmp_path = Path("/tmp") / f"ingest-{source_hash}.pdf"
    tmp_path.write_bytes(file_bytes)
    try:
        parsed = parse_pdf(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    image_by_marker = {im.marker: im for im in parsed.images}
    bank = extract_bank(
        parsed.full_text, valid_markers=set(image_by_marker.keys())
    )

    rows: list[Question] = []
    for q in bank.questions:
        img = image_by_marker.get(q.image_marker) if q.image_marker else None
        alts = (
            [{"label": a.label, "text": a.text} for a in q.alternatives]
            if q.kind == "multiple_choice" and q.alternatives
            else None
        )
        row = Question(
            prompt=q.prompt,
            answer=q.answer,
            kind=q.kind,
            alternatives=alts,
            correct_alternative=(
                q.correct_alternative if q.kind == "multiple_choice" else None
            ),
            asignatura=bank.asignatura,
            nivel=bank.nivel,
            oa_code=bank.oa_code,
            habilidad=bank.habilidad,
            contenido=bank.contenido,
            source_file=file_name,
            source_hash=source_hash,
            image_data=img.png_bytes if img else None,
            image_mime="image/png" if img else None,
            image_width=img.width if img else None,
            image_height=img.height if img else None,
        )
        db.add(row)
        rows.append(row)

    db.commit()
    for r in rows:
        db.refresh(r)
    return rows
