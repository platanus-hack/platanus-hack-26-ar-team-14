"""Public interface — both for the LangChain agent and direct callers.

Three tools, intentionally narrow:

- `obtener_oa`        deterministic catalog lookup over Bases Curriculares
- `buscar_actividades` semantic search over the Programa, filterable by unit
- `listar_unidades`   static map of the four units (titles + page ranges)

Tools return JSON-serializable dicts so the agent and HTTP handlers share
one shape.
"""

from __future__ import annotations

from langchain_core.tools import tool

from app.curriculum.parser import PROGRAMA_UNIDADES
from app.curriculum.store import get_oa_catalog, get_vectorstore

UNIDAD_TITULOS = {
    1: "Números naturales: representación, multiplicación y división",
    2: "Geometría y medición",
    3: "Fracciones, decimales, patrones y ecuaciones",
    4: "Datos y probabilidades",
}


@tool
def obtener_oa(codigo: str | None = None, eje: str | None = None) -> list[dict]:
    """Devuelve Objetivos de Aprendizaje (OA) oficiales de Matemática 5° básico
    desde las Bases Curriculares MINEDUC.

    Args:
        codigo: filtra por código exacto, ej. "OA1", "OA15".
        eje: filtra por eje, ej. "Geometría", "Números y Operaciones",
             "Patrones y Álgebra", "Medición", "Datos y Probabilidades".

    Sin filtros devuelve los 27 OAs.
    """
    catalog = get_oa_catalog()
    results = catalog
    if codigo:
        codigo_norm = codigo.upper().replace(" ", "")
        results = tuple(o for o in results if o.codigo == codigo_norm)
    if eje:
        eje_lower = eje.lower()
        results = tuple(o for o in results if eje_lower in o.eje.lower())
    return [
        {
            "codigo": o.codigo,
            "eje": o.eje,
            "asignatura": o.asignatura,
            "nivel": o.nivel,
            "texto": o.texto,
        }
        for o in results
    ]


@tool
def buscar_actividades(
    consulta: str,
    unidad: int | None = None,
    k: int = 5,
) -> list[dict]:
    """Búsqueda semántica sobre el Programa de Estudio Matemática 5° básico
    (actividades, indicadores, orientaciones didácticas).

    Args:
        consulta: pregunta o tema en lenguaje natural.
        unidad: 1, 2, 3 o 4 para filtrar por unidad. None = todas.
        k: número de resultados (default 5, máximo 10).

    Devuelve fragmentos del Programa con su unidad, página y OA referenciados.
    """
    k = max(1, min(k, 10))
    store = get_vectorstore()
    filter_ = {"unidad": unidad} if unidad in PROGRAMA_UNIDADES else None
    docs = store.similarity_search(consulta, k=k, filter=filter_)
    return [
        {
            "unidad": d.metadata.get("unidad"),
            "pagina": d.metadata.get("pagina"),
            "oa_codes": [c for c in d.metadata.get("oa_codes", "").split(",") if c],
            "texto": d.page_content,
        }
        for d in docs
    ]


@tool
def listar_unidades() -> list[dict]:
    """Lista las 4 unidades del Programa de Matemática 5° básico con su
    título y rango de páginas en el PDF oficial."""
    return [
        {
            "unidad": n,
            "titulo": UNIDAD_TITULOS[n],
            "pagina_inicio": start,
            "pagina_fin": end,
        }
        for n, (start, end) in PROGRAMA_UNIDADES.items()
    ]


CURRICULUM_TOOLS = [obtener_oa, buscar_actividades, listar_unidades]
