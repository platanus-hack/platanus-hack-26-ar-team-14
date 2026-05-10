"""Planificación: utilidades de calendario y extracción de planes anuales."""

from app.planificacion.extract import (
    PlanAnualDraft,
    PlanAnualDraftItem,
    extract_plan_from_pdf,
)
from app.planificacion.crud_tools import (
    PLAN_CRUD_TOOLS,
    actualizar_item_plan,
    crear_item_plan,
    eliminar_item_plan,
    listar_plan,
)
from app.planificacion.material_tools import (
    MATERIAL_TOOLS,
    crear_material_para_plan,
)
from app.planificacion.tools import (
    clases_en_mes,
    clases_restantes_mes,
)

PLANIFICACION_TOOLS = [
    clases_en_mes,
    clases_restantes_mes,
    *PLAN_CRUD_TOOLS,
    *MATERIAL_TOOLS,
]

__all__ = [
    "PLANIFICACION_TOOLS",
    "PlanAnualDraft",
    "PlanAnualDraftItem",
    "actualizar_item_plan",
    "clases_en_mes",
    "clases_restantes_mes",
    "crear_item_plan",
    "crear_material_para_plan",
    "eliminar_item_plan",
    "extract_plan_from_pdf",
    "listar_plan",
]
