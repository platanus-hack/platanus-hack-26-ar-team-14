"""Assessment tools for the replanning agent."""

from __future__ import annotations

from langchain_core.tools import tool

from app.db import SessionLocal
from app.models import Assessment, AssessmentOaMetric, PlanAnualItem


def _serialize_metric(metric: AssessmentOaMetric) -> dict:
    return {
        "oa_code": metric.oa_code,
        "question_ordinals": list(metric.question_ordinals or []),
        "mastery_pct": metric.mastery_pct,
        "average_score": metric.average_score,
        "max_score": metric.max_score,
        "student_count": metric.student_count,
        "weak": metric.weak,
        "evidence_summary": metric.evidence_summary,
    }


@tool
def listar_evaluaciones_curso(course_id: int) -> dict:
    """Lista evaluaciones cargadas para un curso, con sus OA débiles."""
    with SessionLocal() as db:
        assessments = (
            db.query(Assessment)
            .filter(Assessment.course_id == course_id)
            .order_by(Assessment.created_at.desc(), Assessment.id.desc())
            .all()
        )
        return {
            "assessments": [
                {
                    "id": assessment.id,
                    "title": assessment.title,
                    "status": assessment.status,
                    "created_at": assessment.created_at.isoformat()
                    if assessment.created_at
                    else None,
                    "weak_oa_codes": sorted(
                        metric.oa_code for metric in assessment.oa_metrics if metric.weak
                    ),
                }
                for assessment in assessments
            ]
        }


@tool
def leer_evaluacion(assessment_id: int) -> dict:
    """Devuelve el resumen estructurado de una evaluación ya procesada."""
    with SessionLocal() as db:
        assessment = db.get(Assessment, assessment_id)
        if assessment is None:
            return {"error": f"Evaluación {assessment_id} no existe."}
        return {
            "id": assessment.id,
            "course_id": assessment.course_id,
            "record_id": assessment.record_id,
            "title": assessment.title,
            "status": assessment.status,
            "question_count": len(assessment.questions),
            "student_count": len(assessment.result_rows),
            "artifacts": [
                {
                    "kind": artifact.kind,
                    "filename": artifact.filename,
                    "content_type": artifact.content_type,
                }
                for artifact in assessment.artifacts
            ],
            "questions": [
                {
                    "ordinal": question.ordinal,
                    "score_key": question.score_key,
                    "oa_codes": list(question.oa_codes or []),
                    "max_points": question.max_points,
                    "prompt": question.prompt,
                }
                for question in assessment.questions
            ],
            "oa_metrics": [
                _serialize_metric(metric)
                for metric in sorted(
                    assessment.oa_metrics, key=lambda item: (item.mastery_pct, item.oa_code)
                )
            ],
        }


@tool
def leer_metricas_oa_evaluacion(assessment_id: int) -> dict:
    """Devuelve solo las métricas OA de una evaluación, ordenadas de peor a mejor."""
    with SessionLocal() as db:
        assessment = db.get(Assessment, assessment_id)
        if assessment is None:
            return {"error": f"Evaluación {assessment_id} no existe."}
        metrics = sorted(
            assessment.oa_metrics,
            key=lambda metric: (metric.mastery_pct, metric.oa_code),
        )
        return {"assessment_id": assessment.id, "metrics": [_serialize_metric(m) for m in metrics]}


@tool
def buscar_items_plan_por_oa(plan_id: int, oa_code: str) -> dict:
    """Busca filas del plan anual que declaran un OA específico."""
    target = (oa_code or "").strip().upper()
    with SessionLocal() as db:
        items = (
            db.query(PlanAnualItem)
            .filter(PlanAnualItem.plan_anual_id == plan_id)
            .order_by(PlanAnualItem.ordinal.asc(), PlanAnualItem.id.asc())
            .all()
        )
        matches = [
            {
                "id": item.id,
                "ordinal": item.ordinal,
                "mes": item.mes,
                "unidad": item.unidad,
                "oa_codes": list(item.oa_codes or []),
                "objetivo": item.objetivo,
            }
            for item in items
            if target in {str(code).upper() for code in (item.oa_codes or [])}
        ]
        return {"plan_id": plan_id, "oa_code": target, "matches": matches}


ASSESSMENT_TOOLS = [
    listar_evaluaciones_curso,
    leer_evaluacion,
    leer_metricas_oa_evaluacion,
    buscar_items_plan_por_oa,
]
