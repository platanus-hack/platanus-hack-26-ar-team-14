"""Agent package — exposes a singleton `agent` ready to invoke.

Layout:
    builder.py        — `build_agent()` wires model + tools + middleware + prompt
    prompts.py        — system prompt(s)
    tools/            — one file per tool, registered in `tools/__init__.py`
    middleware/       — one file per middleware, registered in `middleware/__init__.py`
"""

from .builder import build_agent

agent = build_agent()

__all__ = ["agent", "build_agent"]
