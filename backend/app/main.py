from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.agent import agent
from app.auth import create_access_token, get_current_teacher, verify_password
from app.chat_status import describe_tool_end, describe_tool_start
from app.config import settings
from app.curriculum import buscar_actividades, listar_unidades, obtener_oa
from app.db import get_db
from app.models import Guia, GuiaItem, Question, Teacher
from app.worksheets.store import ingest_pdf

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


# ──────────────────────────── Question bank ────────────────────────────


class AlternativeOut(BaseModel):
    label: str
    text: str


class QuestionOut(BaseModel):
    id: int
    kind: str
    prompt: str
    alternatives: list[AlternativeOut]
    correct_alternative: str | None
    answer: str | None
    asignatura: str | None
    nivel: str | None
    oa_code: str | None
    habilidad: str | None
    contenido: str | None
    source_file: str | None
    has_image: bool
    image_url: str | None
    image_width: int | None
    image_height: int | None


def _question_out(q: Question) -> QuestionOut:
    has_img = q.image_data is not None
    raw_alts = q.alternatives or []
    return QuestionOut(
        id=q.id,
        kind=q.kind or "open",
        prompt=q.prompt,
        alternatives=[
            AlternativeOut(label=a.get("label", ""), text=a.get("text", ""))
            for a in raw_alts
        ],
        correct_alternative=q.correct_alternative,
        answer=q.answer,
        asignatura=q.asignatura,
        nivel=q.nivel,
        oa_code=q.oa_code,
        habilidad=q.habilidad,
        contenido=q.contenido,
        source_file=q.source_file,
        has_image=has_img,
        image_url=f"/questions/{q.id}/image" if has_img else None,
        image_width=q.image_width,
        image_height=q.image_height,
    )


@app.post("/questions/extract", response_model=list[QuestionOut])
async def extract_questions_from_pdf(
    file: UploadFile = File(...),
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Upload a worksheet PDF; returns the question rows it contributed
    to the bank (existing rows from a prior upload are returned unchanged)."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Sube un archivo .pdf")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    try:
        rows = ingest_pdf(db, file_name=file.filename, file_bytes=file_bytes)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Falló la ingesta: {e}") from e
    return [_question_out(r) for r in rows]


@app.get("/questions", response_model=list[QuestionOut])
def list_questions(
    oa_code: str | None = None,
    nivel: str | None = None,
    asignatura: str | None = None,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    q = db.query(Question)
    if oa_code:
        q = q.filter(Question.oa_code == oa_code)
    if nivel:
        q = q.filter(Question.nivel == nivel)
    if asignatura:
        q = q.filter(Question.asignatura == asignatura)
    rows = q.order_by(Question.created_at.desc()).all()
    return [_question_out(r) for r in rows]


@app.get("/questions/{question_id}", response_model=QuestionOut)
def get_question(
    question_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    row = db.get(Question, question_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Pregunta no existe")
    return _question_out(row)


@app.get("/questions/{question_id}/image")
def get_question_image(question_id: int, db: Session = Depends(get_db)):
    row = db.get(Question, question_id)
    if row is None or row.image_data is None:
        raise HTTPException(status_code=404, detail="Sin imagen")
    return Response(content=row.image_data, media_type=row.image_mime or "image/png")


@app.delete("/questions")
def delete_all_questions(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    deleted = db.query(Question).delete()
    db.commit()
    return {"deleted": deleted}


# ──────────────────────────── Guías (worksheet builder) ────────────────────────────


class GuiaCreate(BaseModel):
    name: str
    question_ids: list[int]


class GuiaSummary(BaseModel):
    id: int
    name: str
    question_count: int


class GuiaDetail(BaseModel):
    id: int
    name: str
    questions: list[QuestionOut]


def _guia_detail(g: Guia) -> GuiaDetail:
    return GuiaDetail(
        id=g.id,
        name=g.name,
        questions=[_question_out(item.question) for item in g.items],
    )


@app.post("/guias", response_model=GuiaDetail)
def create_guia(
    body: GuiaCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Falta el nombre")
    if not body.question_ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos una pregunta")

    found = (
        db.query(Question.id).filter(Question.id.in_(body.question_ids)).all()
    )
    found_ids = {row.id for row in found}
    missing = [qid for qid in body.question_ids if qid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Preguntas inexistentes: {missing}"
        )

    guia = Guia(teacher_id=teacher.id, name=name)
    for ord_, qid in enumerate(body.question_ids, start=1):
        guia.items.append(GuiaItem(question_id=qid, ordinal=ord_))
    db.add(guia)
    db.commit()
    db.refresh(guia)
    return _guia_detail(guia)


@app.get("/guias", response_model=list[GuiaSummary])
def list_guias(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Guia)
        .filter(Guia.teacher_id == teacher.id)
        .order_by(Guia.created_at.desc())
        .all()
    )
    return [
        GuiaSummary(id=r.id, name=r.name, question_count=len(r.items))
        for r in rows
    ]


@app.get("/guias/{guia_id}", response_model=GuiaDetail)
def get_guia(
    guia_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    guia = db.get(Guia, guia_id)
    if guia is None or guia.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Guía no existe")
    return _guia_detail(guia)


@app.put("/guias/{guia_id}", response_model=GuiaDetail)
def update_guia(
    guia_id: int,
    body: GuiaCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    guia = db.get(Guia, guia_id)
    if guia is None or guia.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Guía no existe")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Falta el nombre")
    if not body.question_ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos una pregunta")

    found = db.query(Question.id).filter(Question.id.in_(body.question_ids)).all()
    found_ids = {row.id for row in found}
    missing = [qid for qid in body.question_ids if qid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Preguntas inexistentes: {missing}"
        )

    guia.name = name
    for item in list(guia.items):
        db.delete(item)
    db.flush()
    for ord_, qid in enumerate(body.question_ids, start=1):
        guia.items.append(GuiaItem(question_id=qid, ordinal=ord_))
    db.commit()
    db.refresh(guia)
    return _guia_detail(guia)


@app.delete("/guias/{guia_id}")
def delete_guia(
    guia_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    guia = db.get(Guia, guia_id)
    if guia is None or guia.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Guía no existe")
    db.delete(guia)
    db.commit()
    return {"deleted": guia_id}
