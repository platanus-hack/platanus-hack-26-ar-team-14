from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain.messages import AIMessageChunk
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


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream the agent's final assistant tokens as plain UTF-8 text.

    Pairs with the AI SDK's `TextStreamChatTransport` on the frontend.
    """

    async def token_stream():
        async for token, _metadata in agent.astream(
            {"messages": [m.model_dump() for m in req.messages]},
            stream_mode="messages",
        ):
            if not isinstance(token, AIMessageChunk):
                continue
            for block in token.content_blocks:
                if block.get("type") == "text" and block.get("text"):
                    yield block["text"]

    return StreamingResponse(token_stream(), media_type="text/plain; charset=utf-8")


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
