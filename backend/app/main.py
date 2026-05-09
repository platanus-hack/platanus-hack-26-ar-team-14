from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.agent import agent
from app.auth import create_access_token, get_current_teacher, verify_password
from app.chat_status import describe_tool_end, describe_tool_start
from app.config import settings
from app.curriculum import buscar_actividades, listar_unidades, obtener_oa
from app.db import get_db
from app.models import Teacher

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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TeacherOut(BaseModel):
    id: int
    name: str
    email: EmailStr


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    teacher: TeacherOut


@app.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.email == req.email).one_or_none()
    if teacher is None or not verify_password(req.password, teacher.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )
    return LoginResponse(
        access_token=create_access_token(teacher_id=teacher.id),
        teacher=TeacherOut(id=teacher.id, name=teacher.name, email=teacher.email),
    )


@app.get("/auth/me", response_model=TeacherOut)
def me(teacher: Teacher = Depends(get_current_teacher)):
    return TeacherOut(id=teacher.id, name=teacher.name, email=teacher.email)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/chat/stream")
async def chat_stream(
    req: ChatRequest,
    teacher: Teacher = Depends(get_current_teacher),
):
    """Stream the agent's tool activity and final tokens as plain UTF-8 text.

    Tool calls are surfaced as short Spanish status lines (prefixed with
    a marker so the frontend can style them) — the user sees what the
    asistente is consulting without reading raw JSON.
    """

    async def event_stream():
        async for event in agent.astream_events(
            {"messages": [m.model_dump() for m in req.messages]},
            version="v2",
        ):
            kind = event["event"]
            if kind == "on_tool_start":
                name = event.get("name", "tool")
                args = event.get("data", {}).get("input", {}) or {}
                yield f"\n\n⏳ {describe_tool_start(name, args)}\n"
            elif kind == "on_tool_end":
                name = event.get("name", "tool")
                output = event.get("data", {}).get("output")
                payload = getattr(output, "content", output)
                yield f"✓ {describe_tool_end(name, payload)}\n\n"
            elif kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk is None:
                    continue
                for block in getattr(chunk, "content_blocks", []):
                    if block.get("type") == "text" and block.get("text"):
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
