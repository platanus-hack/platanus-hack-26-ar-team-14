"""Herramientas de edición del plan anual para el agente UTP.

El agente conoce el `plan_id` porque la URL `/planificacion/{id}` lo
inyecta en la conversación. Usa estas herramientas para listar las filas
del plan y aplicarles correcciones (alta, edición, baja). Cada
operación corre en su propia sesión SQLAlchemy y persiste de inmediato.
"""

from __future__ import annotations

from langchain_core.tools import tool

from app.db import SessionLocal
from app.models import PlanAnual, PlanAnualItem


def _serialize_item(item: PlanAnualItem) -> dict:
    material = item.material
    material_dict: dict | None = None
    if material is not None:
        material_dict = {
            "id": material.id,
            "name": material.name,
            "kind": material.kind,
            "guia_id": material.guia_id,
        }
    return {
        "id": item.id,
        "ordinal": item.ordinal,
        "mes": item.mes,
        "unidad": item.unidad,
        "oa_codes": list(item.oa_codes or []),
        "objetivo": item.objetivo,
        "material": material_dict,
    }


@tool
def listar_plan(plan_id: int) -> dict:
    """Devuelve la cabecera del plan anual y todas sus filas, ordenadas.

    Args:
        plan_id: id del plan a leer (lo entrega la URL al agente).
    """
    with SessionLocal() as db:
        plan = db.get(PlanAnual, plan_id)
        if plan is None:
            return {"error": f"Plan {plan_id} no existe."}
        return {
            "id": plan.id,
            "name": plan.name,
            "asignatura": plan.asignatura,
            "curso": plan.curso,
            "anio": plan.anio,
            "docente": plan.docente,
            "items": [_serialize_item(it) for it in plan.items],
        }


@tool
def crear_item_plan(
    plan_id: int,
    objetivo: str,
    oa_codes: list[str] | None = None,
    mes: str | None = None,
    unidad: str | None = None,
    ordinal: int | None = None,
) -> dict:
    """Agrega una fila nueva al plan anual.

    Args:
        plan_id: id del plan.
        objetivo: texto del objetivo de aprendizaje.
        oa_codes: códigos OA, ej. ["OA1", "OA15"]. Lista vacía si la fila
            no declara ningún OA.
        mes: mes en español ('Marzo', 'Abril', ...). None si no aplica.
        unidad: etiqueta de unidad ('Unidad 1'). None si no aplica.
        ordinal: posición. Si es None, se agrega al final.
    """
    with SessionLocal() as db:
        plan = db.get(PlanAnual, plan_id)
        if plan is None:
            return {"error": f"Plan {plan_id} no existe."}
        if ordinal is None:
            ordinal = (max((it.ordinal for it in plan.items), default=-1)) + 1
        item = PlanAnualItem(
            plan_anual_id=plan_id,
            ordinal=ordinal,
            mes=mes,
            unidad=unidad,
            oa_codes=list(oa_codes or []),
            objetivo=objetivo,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return {"ok": True, "item": _serialize_item(item)}


@tool
def actualizar_item_plan(
    item_id: int,
    objetivo: str | None = None,
    oa_codes: list[str] | None = None,
    mes: str | None = None,
    unidad: str | None = None,
    ordinal: int | None = None,
) -> dict:
    """Edita una fila existente. Solo se actualizan los campos que pasas.

    Para limpiar un campo opcional pasa explícitamente `null` (en JSON-tool
    eso llega como None, pero distinguir no-pasado vs limpiar requiere usar
    el campo). Por simplicidad: si pasas un valor distinto de None se
    asigna; para borrar mes/unidad pasa una cadena vacía y luego usa esta
    herramienta de nuevo si necesitas afinar.
    """
    with SessionLocal() as db:
        item = db.get(PlanAnualItem, item_id)
        if item is None:
            return {"error": f"Item {item_id} no existe."}
        if objetivo is not None:
            item.objetivo = objetivo
        if oa_codes is not None:
            item.oa_codes = list(oa_codes)
        if mes is not None:
            item.mes = mes or None
        if unidad is not None:
            item.unidad = unidad or None
        if ordinal is not None:
            item.ordinal = ordinal
        db.commit()
        db.refresh(item)
        return {"ok": True, "item": _serialize_item(item)}


@tool
def eliminar_item_plan(item_id: int) -> dict:
    """Borra una fila del plan anual."""
    with SessionLocal() as db:
        item = db.get(PlanAnualItem, item_id)
        if item is None:
            return {"error": f"Item {item_id} no existe."}
        db.delete(item)
        db.commit()
        return {"ok": True, "deleted": item_id}


PLAN_CRUD_TOOLS = [
    listar_plan,
    crear_item_plan,
    actualizar_item_plan,
    eliminar_item_plan,
]
