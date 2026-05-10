"""Guía search, clone, and creation tools for the agent."""

from __future__ import annotations

from langchain_core.tools import tool
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.guias.generation import generate_remediation_guide
from app.models import GeneratedGuiaQuestion, Guia, GuiaItem, PlanAnual, Question


def _serialize_question(q: Question) -> dict:
    return {
        "id": q.id,
        "oa_code": q.oa_code,
        "kind": q.kind,
        "habilidad": q.habilidad,
        "contenido": q.contenido,
        "prompt": q.prompt,
    }


def _serialize_generated(q: GeneratedGuiaQuestion) -> dict:
    return {
        "type": "generated",
        "ordinal": q.ordinal,
        "kind": q.kind,
        "prompt": q.prompt,
        "alternatives": list(q.alternatives or []),
        "correct_alternative": q.correct_alternative,
        "answer": q.answer,
        "oa_code": q.oa_code,
        "habilidad": q.habilidad,
        "contenido": q.contenido,
        "source_note": q.source_note,
    }


@tool
def buscar_preguntas_por_oa(
    oa_code: str,
    limit: int = 8,
    kind: str | None = None,
    contenido: str | None = None,
    habilidad: str | None = None,
) -> dict:
    """Busca preguntas del banco por OA y filtros livianos."""
    limit = max(1, min(limit, 20))
    with SessionLocal() as db:
        query = db.query(Question).filter(Question.oa_code == oa_code.strip().upper())
        if kind:
            query = query.filter(Question.kind == kind)
        if contenido:
            query = query.filter(Question.contenido.ilike(f"%{contenido.strip()}%"))
        if habilidad:
            query = query.filter(Question.habilidad.ilike(f"%{habilidad.strip()}%"))
        rows = (
            query.order_by(Question.created_at.desc(), Question.id.desc())
            .limit(limit)
            .all()
        )
        return {"matches": [_serialize_question(row) for row in rows]}


@tool
def leer_guia(guia_id: int) -> dict:
    """Lee el contenido ordenado de una guía."""
    with SessionLocal() as db:
        guia = db.get(Guia, guia_id)
        if guia is None:
            return {"error": f"Guía {guia_id} no existe."}
        items: list[dict] = []
        for item in guia.items:
            items.append(
                {
                    "type": "bank",
                    "ordinal": item.ordinal,
                    "question": _serialize_question(item.question),
                }
            )
        for item in guia.generated_questions:
            items.append(_serialize_generated(item))
        items.sort(key=lambda item: item["ordinal"])
        return {"id": guia.id, "name": guia.name, "items": items}


@tool
def clonar_guia(guia_id: int, name: str) -> dict:
    """Clona una guía completa para editarla sin tocar la original."""
    with SessionLocal() as db:
        guia = db.get(Guia, guia_id)
        if guia is None:
            return {"error": f"Guía {guia_id} no existe."}
        cloned = Guia(
            teacher_id=guia.teacher_id, name=name.strip() or f"{guia.name} copia"
        )
        db.add(cloned)
        db.flush()
        for item in guia.items:
            cloned.items.append(
                GuiaItem(question_id=item.question_id, ordinal=item.ordinal)
            )
        for item in guia.generated_questions:
            cloned.generated_questions.append(
                GeneratedGuiaQuestion(
                    ordinal=item.ordinal,
                    prompt=item.prompt,
                    answer=item.answer,
                    kind=item.kind,
                    alternatives=list(item.alternatives or []) or None,
                    correct_alternative=item.correct_alternative,
                    oa_code=item.oa_code,
                    habilidad=item.habilidad,
                    contenido=item.contenido,
                    source_note=item.source_note,
                )
            )
        db.commit()
        db.refresh(cloned)
        return {
            "id": cloned.id,
            "name": cloned.name,
            "editor_url": f"/guias/editor/{cloned.id}",
        }


def _teacher_id_from_plan(db: Session, plan_id: int) -> int | None:
    plan = db.get(PlanAnual, plan_id)
    return plan.teacher_id if plan is not None else None


@tool
def crear_guia_desde_banco(name: str, plan_id: int, question_ids: list[int]) -> dict:
    """Crea una guía usando preguntas ya existentes del banco."""
    with SessionLocal() as db:
        if not question_ids:
            return {"error": "Pasa al menos una pregunta."}
        found = db.query(Question.id).filter(Question.id.in_(question_ids)).all()
        found_ids = {row.id for row in found}
        missing = [qid for qid in question_ids if qid not in found_ids]
        if missing:
            return {"error": f"Preguntas inexistentes: {missing}"}
        teacher_id = _teacher_id_from_plan(db, plan_id)
        if teacher_id is None:
            return {"error": f"Plan {plan_id} no existe."}
        guia = Guia(name=name.strip() or "Guía nueva", teacher_id=teacher_id)
        db.add(guia)
        db.flush()
        for ord_, qid in enumerate(question_ids, start=1):
            guia.items.append(GuiaItem(question_id=qid, ordinal=ord_))
        db.commit()
        db.refresh(guia)
        return {
            "id": guia.id,
            "name": guia.name,
            "editor_url": f"/guias/editor/{guia.id}",
        }


@tool
def crear_guia_mixta(
    name: str,
    plan_id: int,
    bank_question_ids: list[int] | None = None,
    generated_questions: list[dict] | None = None,
) -> dict:
    """Crea una guía con mezcla de banco y preguntas generadas."""
    with SessionLocal() as db:
        bank_question_ids = list(bank_question_ids or [])
        generated_questions = list(generated_questions or [])
        if not bank_question_ids and not generated_questions:
            return {"error": "Pasa preguntas de banco o generadas."}
        if bank_question_ids:
            found = (
                db.query(Question.id).filter(Question.id.in_(bank_question_ids)).all()
            )
            found_ids = {row.id for row in found}
            missing = [qid for qid in bank_question_ids if qid not in found_ids]
            if missing:
                return {"error": f"Preguntas inexistentes: {missing}"}
        teacher_id = _teacher_id_from_plan(db, plan_id)
        if teacher_id is None:
            return {"error": f"Plan {plan_id} no existe."}
        guia = Guia(name=name.strip() or "Guía nueva", teacher_id=teacher_id)
        db.add(guia)
        db.flush()
        ordinal = 1
        for qid in bank_question_ids:
            guia.items.append(GuiaItem(question_id=qid, ordinal=ordinal))
            ordinal += 1
        for question in generated_questions:
            guia.generated_questions.append(
                GeneratedGuiaQuestion(
                    ordinal=ordinal,
                    prompt=str(question.get("prompt", "")).strip(),
                    answer=question.get("answer"),
                    kind=str(question.get("kind", "open")),
                    alternatives=question.get("alternatives") or None,
                    correct_alternative=question.get("correct_alternative"),
                    oa_code=question.get("oa_code"),
                    habilidad=question.get("habilidad"),
                    contenido=question.get("contenido"),
                    source_note=question.get("source_note"),
                )
            )
            ordinal += 1
        db.commit()
        db.refresh(guia)
        return {
            "id": guia.id,
            "name": guia.name,
            "editor_url": f"/guias/editor/{guia.id}",
        }


@tool
def generar_borrador_guia(
    name: str,
    oa_codes: list[str],
    weak_metrics: list[dict] | None = None,
    plan_context: str | None = None,
) -> dict:
    """Genera preguntas nuevas para una guía de refuerzo cuando no alcanza el banco."""
    draft = generate_remediation_guide(
        oa_codes=oa_codes,
        weak_metrics=list(weak_metrics or []),
        plan_context=(plan_context or "").strip(),
        suggested_name=name,
    )
    return {
        "name": draft.name,
        "generated_questions": [question.model_dump() for question in draft.questions],
    }


GUIA_GENERATION_TOOLS = [
    buscar_preguntas_por_oa,
    leer_guia,
    clonar_guia,
    crear_guia_desde_banco,
    crear_guia_mixta,
    generar_borrador_guia,
]
