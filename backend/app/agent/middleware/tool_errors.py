"""Catch tool exceptions and turn them into a ToolMessage the model can read.

Class-style middleware so the same logic covers both sync (`invoke`/`stream`)
and async (`ainvoke`/`astream`) execution paths. The decorator form only
registers one of the two and crashes when the agent is invoked from the
opposite context.
"""

from langchain.agents.middleware import AgentMiddleware
from langchain.messages import ToolMessage


class HandleToolErrors(AgentMiddleware):
    def wrap_tool_call(self, request, handler):
        try:
            return handler(request)
        except Exception as e:
            return ToolMessage(
                content=(
                    f"TOOL ERROR ({type(e).__name__}): {e}. "
                    "Do NOT fabricate a substitute answer. Either retry with "
                    "different arguments or tell the user the tool is "
                    "unavailable so they can fix the problem."
                ),
                tool_call_id=request.tool_call["id"],
            )

    async def awrap_tool_call(self, request, handler):
        try:
            return await handler(request)
        except Exception as e:
            return ToolMessage(
                content=(
                    f"TOOL ERROR ({type(e).__name__}): {e}. "
                    "Do NOT fabricate a substitute answer. Either retry with "
                    "different arguments or tell the user the tool is "
                    "unavailable so they can fix the problem."
                ),
                tool_call_id=request.tool_call["id"],
            )


handle_tool_errors = HandleToolErrors()
