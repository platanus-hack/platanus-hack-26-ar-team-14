"""Herramienta de agente para crear y asignar material a una fila del plan.

Cuando el docente sube una guía en el chat, el handler de archivos la
ingresa al banco y crea una `Guia`. Después el agente conoce el `guia_id`
y solo necesita:

1. Leer el plan con `listar_plan` para encontrar la fila correcta (mes/OA).
2. Llamar a `crear_material_para_plan` con esa fila y la guía recién subida.

Este tool envuelve la guía en un `Material` (kind 'guia' o 'recurso') y
deja el `material_id` apuntando desde el `PlanAnualItem`. Las pruebas y
sus resultados viven en el modelo `Assessment`, no acá.
"""

from __future__ import annotations

from langchain_core.tools import tool

from app.db import SessionLocal
from app.models import Guia, Material, PlanAnualItem


@tool
def crear_material_para_plan(
    plan_item_id: int,
    name: str,
    kind: str,
    guia_id: int | None = None,
) -> dict:
    """Crea un material y lo asocia a una fila del plan anual.

    Úsalo después de que el docente subió una guía (ya quedó en el
    banco como `Guia` con su `guia_id`) y quiere verla colgada de una
    fila concreta del plan. Para encontrar la fila correcta usa
    `listar_plan`: cada item trae `mes`, `oa_codes` y `material` (None
    si está libre).

    Args:
        plan_item_id: id del item del plan donde colgar el material.
            Debe estar libre (sin material previo).
        name: nombre visible (ej. "Guía OA5 · Mayo").
        kind: 'guia' para material de práctica o 'recurso' para otros
            materiales. Las pruebas no se registran acá; usa el flujo
            de evaluaciones (`Assessment`).
        guia_id: id de la guía a la que apunta el material. Requerido
            para que el frontend pueda enlazar al editor de guías;
            opcional si solo registras un recurso externo.
    """
    if kind not in ("guia", "recurso"):
        return {
            "error": "kind debe ser 'guia' o 'recurso'.",
        }
    with SessionLocal() as db:
        item = db.get(PlanAnualItem, plan_item_id)
        if item is None:
            return {"error": f"Item {plan_item_id} no existe."}
        if item.material_id is not None:
            return {
                "error": (
                    f"La fila ya tiene material id={item.material_id}. "
                    "Elige otra fila libre del mismo mes o pide al "
                    "docente reemplazar el material existente."
                )
            }
        if guia_id is not None:
            guia = db.get(Guia, guia_id)
            if guia is None:
                return {"error": f"Guía {guia_id} no existe."}

        material = Material(
            name=name,
            kind=kind,
            guia_id=guia_id,
        )
        db.add(material)
        db.flush()
        item.material_id = material.id
        db.commit()
        db.refresh(material)
        db.refresh(item)
        return {
            "ok": True,
            "material_id": material.id,
            "plan_item_id": item.id,
            "kind": kind,
            "guia_id": guia_id,
            "mes": item.mes,
            "oa_codes": list(item.oa_codes or []),
        }


MATERIAL_TOOLS = [crear_material_para_plan]
