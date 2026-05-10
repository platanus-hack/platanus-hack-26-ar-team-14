"""Human-readable status lines for the agent's tool activity.

The chat stream surfaces what the asistente is doing so the teacher (a
non-technical user) can see real work happening, not raw JSON. Each
curriculum tool gets two short Spanish lines:

    ⏳ <what the asistente is about to do>
    ✓ <what came back>

Adding a new tool? Add an entry to `_START` and `_END` keyed by the tool
name. Unknown tools fall back to a generic message.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any


def _safe_load(payload: Any) -> Any:
    if isinstance(payload, (dict, list)):
        return payload
    if isinstance(payload, str):
        try:
            return json.loads(payload)
        except (TypeError, ValueError, json.JSONDecodeError):
            return payload
    return payload


def _count(payload: Any) -> int | None:
    data = _safe_load(payload)
    if isinstance(data, list):
        return len(data)
    return None


# --- per-tool descriptions ----------------------------------------------------


def _start_listar_unidades(_args: dict) -> str:
    return "Revisando las unidades del Programa de Estudio…"


def _end_listar_unidades(payload: Any) -> str:
    n = _count(payload)
    return f"Encontré {n} unidades." if n else "Listo."


def _start_obtener_oa(args: dict) -> str:
    codigo = args.get("codigo")
    eje = args.get("eje")
    if codigo:
        return f"Buscando el OA {codigo}…"
    if eje:
        return f"Buscando los OA del eje «{eje}»…"
    return "Listando todos los OA del nivel…"


def _end_obtener_oa(payload: Any) -> str:
    n = _count(payload)
    if n is None:
        return "Listo."
    if n == 0:
        return "No encontré OA con esos criterios."
    return f"Encontré {n} OA."


def _start_buscar_actividades(args: dict) -> str:
    consulta = args.get("consulta", "")
    unidad = args.get("unidad")
    where = f" en la Unidad {unidad}" if unidad else ""
    return f"Buscando actividades sobre «{consulta}»{where}…"


def _end_buscar_actividades(payload: Any) -> str:
    n = _count(payload)
    if n is None:
        return "Listo."
    if n == 0:
        return "No encontré fragmentos relevantes."
    return f"Encontré {n} fragmentos del Programa."


def _start_listar_plan(_args: dict) -> str:
    return "Leyendo el plan anual…"


def _end_listar_plan(payload: Any) -> str:
    data = _safe_load(payload)
    if isinstance(data, dict) and isinstance(data.get("items"), list):
        return f"Plan con {len(data['items'])} filas."
    return "Listo."


def _start_crear_item_plan(args: dict) -> str:
    oa = args.get("oa_codes") or []
    if oa:
        return f"Agregando fila al plan ({', '.join(oa)})…"
    return "Agregando fila al plan…"


def _end_crear_item_plan(_payload: Any) -> str:
    return "Fila agregada."


def _start_actualizar_item_plan(args: dict) -> str:
    item_id = args.get("item_id")
    return (
        f"Editando fila {item_id} del plan…" if item_id else "Editando fila del plan…"
    )


def _end_actualizar_item_plan(_payload: Any) -> str:
    return "Fila actualizada."


def _start_eliminar_item_plan(args: dict) -> str:
    item_id = args.get("item_id")
    return (
        f"Eliminando fila {item_id} del plan…"
        if item_id
        else "Eliminando fila del plan…"
    )


def _end_eliminar_item_plan(_payload: Any) -> str:
    return "Fila eliminada."


def _start_clases_en_mes(args: dict) -> str:
    mes = args.get("mes")
    return f"Calculando clases del mes {mes}…" if mes else "Calculando clases del mes…"


def _end_clases_en_mes(_payload: Any) -> str:
    return "Listo."


def _start_clases_restantes_mes(_args: dict) -> str:
    return "Calculando clases restantes del mes…"


_START: dict[str, Callable[[dict], str]] = {
    "listar_unidades": _start_listar_unidades,
    "obtener_oa": _start_obtener_oa,
    "buscar_actividades": _start_buscar_actividades,
    "listar_plan": _start_listar_plan,
    "crear_item_plan": _start_crear_item_plan,
    "actualizar_item_plan": _start_actualizar_item_plan,
    "eliminar_item_plan": _start_eliminar_item_plan,
    "clases_en_mes": _start_clases_en_mes,
    "clases_restantes_mes": _start_clases_restantes_mes,
}

_END: dict[str, Callable[[Any], str]] = {
    "listar_unidades": _end_listar_unidades,
    "obtener_oa": _end_obtener_oa,
    "buscar_actividades": _end_buscar_actividades,
    "listar_plan": _end_listar_plan,
    "crear_item_plan": _end_crear_item_plan,
    "actualizar_item_plan": _end_actualizar_item_plan,
    "eliminar_item_plan": _end_eliminar_item_plan,
    "clases_en_mes": _end_clases_en_mes,
}


def describe_tool_start(name: str, args: dict) -> str:
    fn = _START.get(name)
    return fn(args) if fn else f"Consultando {name}…"


def describe_tool_end(name: str, output: Any) -> str:
    fn = _END.get(name)
    return fn(output) if fn else "Listo."
