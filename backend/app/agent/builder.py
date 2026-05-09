"""Compose the agent from the registries in this package."""

from langchain.agents import create_agent
from langchain_anthropic import ChatAnthropic

from app.config import settings

from .middleware import MIDDLEWARE
from .prompts import SYSTEM_PROMPT
from .tools import TOOLS


def build_agent(model: str | None = None):
    chat_model = ChatAnthropic(
        model=model or settings.agent_model,
        api_key=settings.anthropic_api_key,
    )
    return create_agent(
        model=chat_model,
        tools=TOOLS,
        middleware=MIDDLEWARE,
        system_prompt=SYSTEM_PROMPT,
    )
