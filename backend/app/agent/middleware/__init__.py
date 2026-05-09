"""Agent middleware registry.

Middleware runs in the order listed. Two ways to add one:

    Decorator style (single hook):
        from langchain.agents.middleware import before_model

        @before_model
        def my_hook(state, runtime):
            ...

    Class style (multiple hooks, can declare its own tools):
        from langchain.agents.middleware import AgentMiddleware

        class MyMiddleware(AgentMiddleware):
            tools = [some_tool]
            def wrap_model_call(self, request, handler): ...
            def wrap_tool_call(self, request, handler): ...

Then import here and append to `MIDDLEWARE`.
"""

from .logging import log_before_model
from .tool_errors import handle_tool_errors

MIDDLEWARE = [
    log_before_model,
    handle_tool_errors,
]

__all__ = ["MIDDLEWARE", "log_before_model", "handle_tool_errors"]
