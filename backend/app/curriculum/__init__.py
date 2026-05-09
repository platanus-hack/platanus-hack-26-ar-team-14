"""Curriculum search: parses MINEDUC Bases + Programa PDFs and exposes
deterministic OA lookup and semantic search over the Programa."""

from app.curriculum.tools import (
    CURRICULUM_TOOLS,
    buscar_actividades,
    listar_unidades,
    obtener_oa,
)

__all__ = [
    "CURRICULUM_TOOLS",
    "buscar_actividades",
    "listar_unidades",
    "obtener_oa",
]
