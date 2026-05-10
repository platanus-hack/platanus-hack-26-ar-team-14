"""Assessment ingest orchestration."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from app.assessments.extract import extract_assessment_from_pdf
from app.assessments.spreadsheets import (
    ParsedResultsRow,
    convert_spreadsheet_to_pdf,
    parse_results_file,
)
from app.models import (
    Assessment,
    AssessmentArtifact,
    AssessmentOaMetric,
    AssessmentQuestion,
    AssessmentResultRow,
)

WEAK_MASTERY_THRESHOLD = 70.0


def ingest_assessment(
    db: Session,
    *,
    course_id: int,
    record_id: int | None,
    test_file_name: str,
    test_content_type: str | None,
    test_bytes: bytes,
    results_file_name: str,
    results_content_type: str | None,
    results_bytes: bytes,
) -> Assessment:
    """Persist uploaded artifacts, structured questions, normalized results, and OA metrics."""
    draft = extract_assessment_from_pdf(test_bytes, filename=test_file_name)
    parsed_results = parse_results_file(results_file_name, results_bytes)
    results_pdf = convert_spreadsheet_to_pdf(results_file_name, results_bytes)

    assessment = Assessment(
        course_id=course_id,
        record_id=record_id,
        title=draft.title or test_file_name,
        status="ready",
    )
    db.add(assessment)
    db.flush()

    assessment.artifacts.extend(
        [
            AssessmentArtifact(
                kind="test_pdf",
                filename=test_file_name,
                content_type=test_content_type,
                data=test_bytes,
            ),
            AssessmentArtifact(
                kind="results_source",
                filename=results_file_name,
                content_type=results_content_type,
                data=results_bytes,
            ),
            AssessmentArtifact(
                kind="results_pdf",
                filename=f"{assessment.title}.results.pdf",
                content_type="application/pdf",
                data=results_pdf,
            ),
        ]
    )

    questions = []
    for fallback_ordinal, question in enumerate(draft.questions, start=1):
        ordinal = question.ordinal or fallback_ordinal
        questions.append(
            AssessmentQuestion(
                ordinal=ordinal,
                score_key=question.score_key or f"P{ordinal}",
                prompt=question.prompt,
                kind=question.kind,
                oa_codes=list(question.oa_codes),
                max_points=question.max_points,
            )
        )
    assessment.questions.extend(questions)

    assessment.result_rows.extend(
        [
            AssessmentResultRow(
                student_name=row.student_name,
                question_scores=row.question_scores,
                total_score=row.total_score,
            )
            for row in parsed_results.rows
        ]
    )

    assessment.oa_metrics.extend(_build_oa_metrics(questions, parsed_results.rows))
    db.commit()
    db.refresh(assessment)
    return assessment


def _build_oa_metrics(
    questions: list[AssessmentQuestion],
    rows: list[ParsedResultsRow],
) -> list[AssessmentOaMetric]:
    per_question_max = _resolve_question_max_points(questions, rows)
    rollup: dict[str, dict] = defaultdict(
        lambda: {
            "question_ordinals": [],
            "average_sum": 0.0,
            "max_sum": 0.0,
            "snippets": [],
        }
    )

    student_count = len(rows)
    for question in questions:
        if not question.oa_codes:
            continue
        max_points = per_question_max.get(question.score_key)
        if not max_points or max_points <= 0:
            continue

        observed_total = 0.0
        observed_count = 0
        for row in rows:
            score = row.question_scores.get(question.score_key)
            if score is None:
                continue
            observed_total += score
            observed_count += 1

        if observed_count == 0:
            continue

        average_score = observed_total / observed_count
        mastery_pct = (average_score / max_points) * 100.0
        summary = f"P{question.ordinal} promedia {mastery_pct:.0f}%"

        for oa_code in question.oa_codes:
            bucket = rollup[oa_code]
            bucket["question_ordinals"].append(question.ordinal)
            bucket["average_sum"] += average_score
            bucket["max_sum"] += max_points
            bucket["snippets"].append(summary)

    metrics: list[AssessmentOaMetric] = []
    for oa_code, bucket in sorted(rollup.items()):
        if bucket["max_sum"] <= 0:
            continue
        mastery_pct = (bucket["average_sum"] / bucket["max_sum"]) * 100.0
        metrics.append(
            AssessmentOaMetric(
                oa_code=oa_code,
                question_ordinals=sorted(set(bucket["question_ordinals"])),
                mastery_pct=round(mastery_pct, 2),
                average_score=round(bucket["average_sum"], 2),
                max_score=round(bucket["max_sum"], 2),
                student_count=student_count,
                weak=mastery_pct < WEAK_MASTERY_THRESHOLD,
                evidence_summary="; ".join(bucket["snippets"][:3]),
            )
        )
    return metrics


def _resolve_question_max_points(
    questions: list[AssessmentQuestion],
    rows: list[ParsedResultsRow],
) -> dict[str, float]:
    resolved: dict[str, float] = {}
    for question in questions:
        if question.max_points is not None and question.max_points > 0:
            resolved[question.score_key] = question.max_points
            continue
        observed = [
            row.question_scores[question.score_key]
            for row in rows
            if question.score_key in row.question_scores
        ]
        if observed:
            resolved[question.score_key] = max(max(observed), 1.0)
    return resolved
