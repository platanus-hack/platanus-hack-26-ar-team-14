"""Agent tools registry.

To add a new tool:
    1. Create a new file in this directory (e.g. `search.py`).
    2. Define your tool with `@tool` from `langchain.tools`.
    3. Import it here and append to `TOOLS`.

Curriculum tools are owned by the `app.curriculum` package — they ship as a
self-contained bundle (`CURRICULUM_TOOLS`) and we re-expose them here so the
agent's tool registry stays the single source of truth.
"""

from app.curriculum import CURRICULUM_TOOLS
from app.planificacion import PLANIFICACION_TOOLS

from .assessments import ASSESSMENT_TOOLS
from .alertas import ALERTAS_TOOLS
from .registro import REGISTRO_TOOLS

TOOLS = [
    *CURRICULUM_TOOLS,
    *PLANIFICACION_TOOLS,
    *REGISTRO_TOOLS,
    *ALERTAS_TOOLS,
    *ASSESSMENT_TOOLS,
]

__all__ = ["TOOLS"]
