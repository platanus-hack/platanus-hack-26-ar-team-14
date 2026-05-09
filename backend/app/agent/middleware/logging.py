"""Example middleware: logs each model call.

Two equivalent styles are shown in this package:
    - Decorator style (this file): quick, single-hook middleware.
    - Class style (see `tool_errors.py`): when you need multiple hooks
      or to register tools alongside the middleware.
"""

from typing import Any

from langchain.agents.middleware import AgentState, before_model
from langgraph.runtime import Runtime


@before_model
def log_before_model(state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
    print(f"[agent] calling model with {len(state['messages'])} messages")
    return None
