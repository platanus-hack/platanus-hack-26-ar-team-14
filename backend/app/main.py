import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agent import agent
from app.config import settings
from app.curriculum import buscar_actividades, listar_unidades, obtener_oa

app = FastAPI(title="Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


def _format_args(args: dict) -> str:
    try:
        s = json.dumps(args, ensure_ascii=False)
    except (TypeError, ValueError):
        s = str(args)
    return s if len(s) <= 200 else s[:200] + "…"


def _format_result(output) -> str:
    text = output if isinstance(output, str) else json.dumps(
        output, ensure_ascii=False, default=str
    )
    text = text.replace("\n", " ")
    return text if len(text) <= 200 else text[:200] + "…"


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream the agent's tool activity and final tokens as plain UTF-8 text.

    Pairs with the AI SDK's `TextStreamChatTransport` on the frontend.
    Tool calls are inlined as readable lines so the user sees what the agent
    is consulting in real time.
    """

    async def event_stream():
        last_was_tool_line = False
        async for event in agent.astream_events(
            {"messages": [m.model_dump() for m in req.messages]},
            version="v2",
        ):
            kind = event["event"]
            if kind == "on_tool_start":
                name = event.get("name", "tool")
                args = event.get("data", {}).get("input", {}) or {}
                yield f"\n\n🔧 `{name}({_format_args(args)})`\n"
                last_was_tool_line = True
            elif kind == "on_tool_end":
                output = event.get("data", {}).get("output")
                preview = _format_result(getattr(output, "content", output))
                yield f"↳ {preview}\n\n"
                last_was_tool_line = True
            elif kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk is None:
                    continue
                for block in getattr(chunk, "content_blocks", []):
                    if block.get("type") == "text" and block.get("text"):
                        if last_was_tool_line:
                            last_was_tool_line = False
                        yield block["text"]

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")


class SearchRequest(BaseModel):
    consulta: str
    unidad: int | None = None
    k: int = 5


@app.post("/search/actividades")
def search_actividades(req: SearchRequest):
    return buscar_actividades.invoke(
        {"consulta": req.consulta, "unidad": req.unidad, "k": req.k}
    )


@app.get("/oa")
def get_oa(codigo: str | None = None, eje: str | None = None):
    return obtener_oa.invoke({"codigo": codigo, "eje": eje})


@app.get("/unidades")
def get_unidades():
    return listar_unidades.invoke({})
