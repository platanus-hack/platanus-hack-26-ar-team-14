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


_START: dict[str, Callable[[dict], str]] = {
    "listar_unidades": _start_listar_unidades,
    "obtener_oa": _start_obtener_oa,
    "buscar_actividades": _start_buscar_actividades,
}

_END: dict[str, Callable[[Any], str]] = {
    "listar_unidades": _end_listar_unidades,
    "obtener_oa": _end_obtener_oa,
    "buscar_actividades": _end_buscar_actividades,
}


def describe_tool_start(name: str, args: dict) -> str:
    fn = _START.get(name)
    return fn(args) if fn else f"Consultando {name}…"


def describe_tool_end(name: str, output: Any) -> str:
    fn = _END.get(name)
    return fn(output) if fn else "Listo."
