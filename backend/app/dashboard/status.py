"""Dashboard categorisation: classify each course of the docente as
acción / desalineado / al día based on plan-anualizado vs libro-de-clases.

Pure functions, fed by main.py with eager-loaded ORM rows + records batch.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.models import Alert, ClassLearningRecord, Course, PlanAnualItem

from .months import month_number, month_title

Category = Literal["accion", "desalineado", "al_dia"]


class CourseStatusOut(BaseModel):
    """A row in the dashboard list. A single course may produce two rows
    when it qualifies for both Acción (material faltante) and Desalineado."""

    id: str
    course_id: int
    name: str
    plan_anual_id: int | None
    category: Category
    sub_tags: list[str]
    reasons: list[str]
    manual_alert_ids: list[int]


_CATEGORY_ORDER: dict[Category, int] = {
    "desalineado": 0,
    "accion": 1,
    "al_dia": 2,
}


def _norm_oa(code: str) -> str:
    """Normalise an OA code: 'OA 8' / '8' / 'oa8' → 'OA8'."""
    raw = (code or "").strip().upper().replace(" ", "")
    if not raw:
        return ""
    return raw if raw.startswith("OA") else f"OA{raw}"


def _months_window(today: date) -> tuple[int, int]:
    """Return (current_month, next_month) wrapping December → January."""
    current = today.month
    nxt = (today.month % 12) + 1
    return current, nxt


def _compute_material_gaps(
    plan_items: list[PlanAnualItem], today: date
) -> list[str]:
    """Reasons for items in current/next month that lack `material_id`."""
    current, nxt = _months_window(today)
    target_months = {current, nxt}
    missing_by_month: dict[int, int] = {}
    for item in plan_items:
        m = month_number(item.mes)
        if m is None or m not in target_months:
            continue
        if item.material_id is None:
            missing_by_month[m] = missing_by_month.get(m, 0) + 1

    reasons: list[str] = []
    for m in sorted(missing_by_month.keys()):
        count = missing_by_month[m]
        unidad = "ítem" if count == 1 else "ítems"
        reasons.append(f"{count} {unidad} sin material en {month_title(m)}")
    return reasons


def _compute_oa_gaps(
    plan_items: list[PlanAnualItem],
    records: list[ClassLearningRecord],
    today: date,
) -> list[str]:
    """For each past month of the current year, list planned OAs that
    never appear in `oa_numbers` of registered records."""
    if today.month <= 1:
        return []
    past_months = range(1, today.month)

    planned_by_month: dict[int, set[str]] = {m: set() for m in past_months}
    for item in plan_items:
        m = month_number(item.mes)
        if m is None or m not in planned_by_month:
            continue
        for code in item.oa_codes or []:
            normalized = _norm_oa(code)
            if normalized:
                planned_by_month[m].add(normalized)

    taught_by_month: dict[int, set[str]] = {m: set() for m in past_months}
    for r in records:
        m = r.class_date.month
        if m not in taught_by_month:
            continue
        for code in r.oa_numbers or []:
            normalized = _norm_oa(code)
            if normalized:
                taught_by_month[m].add(normalized)

    reasons: list[str] = []
    for m in past_months:
        gap = sorted(planned_by_month[m] - taught_by_month[m])
        if gap:
            shown = ", ".join(gap[:4])
            if len(gap) > 4:
                shown += f" (+{len(gap) - 4} más)"
            reasons.append(f"OAs sin registro: {shown} ({month_title(m).lower()})")
    return reasons


def _manual_alert_reasons(alerts: list[Alert]) -> tuple[list[str], list[int]]:
    """Take up to 3 most-recent manual alerts; surface the first
    observation of each. Returns (reasons, alert_ids)."""
    sorted_alerts = sorted(
        alerts,
        key=lambda a: (a.created_at or date.min, a.id),
        reverse=True,
    )[:3]
    reasons: list[str] = []
    ids: list[int] = []
    for a in sorted_alerts:
        ids.append(a.id)
        first = next(
            (str(o).strip() for o in (a.observations or []) if str(o).strip()),
            None,
        )
        reasons.append(first or "Alerta sin observaciones registradas.")
    return reasons, ids


def classify_course(
    course: Course,
    records: list[ClassLearningRecord],
    today: date,
) -> list[CourseStatusOut]:
    """Produce one or two dashboard rows for a single course.

    Rules summary (plan vast-dancing-stallman):
    - No `plan_anual` linked → Acción + sub_tag "sin_plan".
    - `plan.anio < today.year` → emit nothing (course is hidden).
    - Manual alerts OR derived OA gaps → Desalineado row.
    - Items with `material_id IS NULL` in current/next month → Acción row.
    - Otherwise → single Al día row.
    - When both Desalineado and Acción apply, emit BOTH rows.
    """
    plan = course.plan_anual

    if plan is None:
        return [
            CourseStatusOut(
                id=f"{course.id}-accion",
                course_id=course.id,
                name=course.name,
                plan_anual_id=None,
                category="accion",
                sub_tags=["sin_plan"],
                reasons=["No hay plan anualizado vinculado"],
                manual_alert_ids=[],
            )
        ]

    if plan.anio is not None and plan.anio < today.year:
        return []

    plan_items = list(plan.items or [])
    material_reasons = _compute_material_gaps(plan_items, today)
    oa_gap_reasons = _compute_oa_gaps(plan_items, records, today)
    manual_reasons, manual_ids = _manual_alert_reasons(list(course.alerts or []))

    desalineado_reasons: list[str] = []
    if manual_reasons:
        desalineado_reasons.extend(manual_reasons)
    desalineado_reasons.extend(
        f"Detectado: {r}" if manual_reasons else r for r in oa_gap_reasons
    )

    rows: list[CourseStatusOut] = []
    if desalineado_reasons:
        rows.append(
            CourseStatusOut(
                id=f"{course.id}-desalineado",
                course_id=course.id,
                name=course.name,
                plan_anual_id=plan.id,
                category="desalineado",
                sub_tags=[],
                reasons=desalineado_reasons,
                manual_alert_ids=manual_ids,
            )
        )
    if material_reasons:
        rows.append(
            CourseStatusOut(
                id=f"{course.id}-accion",
                course_id=course.id,
                name=course.name,
                plan_anual_id=plan.id,
                category="accion",
                sub_tags=[],
                reasons=material_reasons,
                manual_alert_ids=[],
            )
        )

    if not rows:
        rows.append(
            CourseStatusOut(
                id=f"{course.id}-al_dia",
                course_id=course.id,
                name=course.name,
                plan_anual_id=plan.id,
                category="al_dia",
                sub_tags=[],
                reasons=["Plan al día con material y registros"],
                manual_alert_ids=[],
            )
        )
    return rows


def sort_status_rows(rows: list[CourseStatusOut]) -> list[CourseStatusOut]:
    """Stable sort: Desalineado → Acción → Al día, preserving inner order."""
    return sorted(rows, key=lambda r: (_CATEGORY_ORDER[r.category], r.course_id))
