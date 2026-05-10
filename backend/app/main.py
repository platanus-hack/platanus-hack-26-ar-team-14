import json
import asyncio
from datetime import date, datetime
from pathlib import Path
import re
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.agent import agent
from app.assessments import ingest_assessment
from app.auth import create_access_token, get_current_teacher, verify_password
from app.chat_attachments import build_last_user_message_content
from app.chat_status import describe_tool_end, describe_tool_start
from app.config import settings
from app.curriculum import buscar_actividades, listar_unidades, obtener_oa
from app.db import get_db
from app.models import (
    Assessment,
    Alert,
    ClassLearningRecord,
    Course,
    Guia,
    GuiaItem,
    PlanAnual,
    PlanAnualItem,
    Question,
    Teacher,
)
from app.planificacion import extract_plan_from_pdf
from app.transcription import transcribe_audio
from app.worksheets.store import ingest_pdf

app = FastAPI(title="Backend API")

# Keep pending-record logic aligned with the frontend dashboard demo clock.
DEMO_NOW = datetime(2026, 5, 13, 9, 30)

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


class CourseOut(BaseModel):
    id: int
    name: str
    class_days: list[str]
    block_number: int
    plan_anual_id: int | None


@app.get("/courses", response_model=list[CourseOut])
def list_courses(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    courses = (
        db.query(Course)
        .filter(Course.teacher_id == teacher.id)
        .order_by(Course.id)
        .all()
    )
    return [
        CourseOut(
            id=c.id,
            name=c.name,
            class_days=list(c.class_days or []),
            block_number=c.block_number,
            plan_anual_id=c.plan_anual_id,
        )
        for c in courses
    ]


class CoursePlanIn(BaseModel):
    plan_anual_id: int | None


@app.put("/courses/{course_id}/plan", response_model=CourseOut)
def set_course_plan(
    course_id: int,
    body: CoursePlanIn,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    course = db.get(Course, course_id)
    if course is None or course.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Curso no existe")
    if body.plan_anual_id is not None:
        plan = db.get(PlanAnual, body.plan_anual_id)
        if plan is None or plan.teacher_id != teacher.id:
            raise HTTPException(status_code=404, detail="Planificación no existe")
    course.plan_anual_id = body.plan_anual_id
    db.commit()
    db.refresh(course)
    return CourseOut(
        id=course.id,
        name=course.name,
        class_days=list(course.class_days or []),
        block_number=course.block_number,
        plan_anual_id=course.plan_anual_id,
    )


class AlertOut(BaseModel):
    id: int
    course_id: int
    course_name: str
    severity: str
    observations: list[str]


@app.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Alert)
        .join(Course, Alert.course_id == Course.id)
        .filter(Course.teacher_id == teacher.id)
        .order_by(Alert.created_at.desc(), Alert.id.desc())
        .all()
    )
    return [
        AlertOut(
            id=a.id,
            course_id=a.course_id,
            course_name=a.course.name,
            severity=a.severity,
            observations=list(a.observations or []),
        )
        for a in rows
    ]


class ChatMessage(BaseModel):
    role: str
    content: str | list[dict]


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


ID_PATTERNS = {
    "plan_id": re.compile(r"\bPlan ID:\s*(\d+)\b", re.IGNORECASE),
    "course_id": re.compile(r"\bCourse ID:\s*(\d+)\b", re.IGNORECASE),
    "record_id": re.compile(r"\bClass Record ID:\s*(\d+)\b", re.IGNORECASE),
    "assessment_id": re.compile(r"\bAssessment ID:\s*(\d+)\b", re.IGNORECASE),
}

CONFIRMATION_RE = re.compile(
    r"^\s*(sí|si|aplica|hazlo|dale|ok|oka|confirmo|házlo)\s*[.!]?\s*$",
    re.IGNORECASE,
)


def _extract_chat_context_ids(messages: list[ChatMessage]) -> dict[str, int | None]:
    joined = "\n".join(
        message.content
        for message in messages
        if isinstance(message.content, str)
    )
    out: dict[str, int | None] = {
        "plan_id": None,
        "course_id": None,
        "record_id": None,
        "assessment_id": None,
    }
    for key, pattern in ID_PATTERNS.items():
        matches = pattern.findall(joined)
        if matches:
            out[key] = int(matches[-1])
    return out


def _augment_followup_with_assessment_context(
    *,
    last_text: str,
    parsed_messages: list[ChatMessage],
) -> str:
    ids = _extract_chat_context_ids(parsed_messages)
    assessment_id = ids.get("assessment_id")
    if assessment_id is None:
        return last_text
    if ID_PATTERNS["assessment_id"].search(last_text):
        return last_text
    if not CONFIRMATION_RE.match(last_text.strip()):
        return last_text
    suffix = (
        f"\n\nAssessment ID: {assessment_id}.\n"
        "Este turno confirma una propuesta previa sobre esa evaluación. "
        "Sigue con esa evaluación y no vuelvas a pedir archivos."
    )
    return f"{last_text.rstrip()}{suffix}"


async def _maybe_ingest_assessment_from_chat(
    *,
    files: list[UploadFile],
    parsed_messages: list[ChatMessage],
    teacher: Teacher,
    db: Session,
) -> tuple[Assessment | None, list[UploadFile]]:
    pdf_files: list[UploadFile] = []
    result_files: list[UploadFile] = []
    passthrough_files: list[UploadFile] = []

    for file in files:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix == ".pdf":
            pdf_files.append(file)
        elif suffix in {".xlsx", ".xls", ".csv"}:
            result_files.append(file)
        else:
            passthrough_files.append(file)

    if len(pdf_files) != 1 or len(result_files) != 1 or passthrough_files:
        return None, files

    ids = _extract_chat_context_ids(parsed_messages)
    course_id = ids.get("course_id")
    if course_id is None:
        return None, files

    course = db.get(Course, course_id)
    if course is None or course.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Curso no existe")

    test_file = pdf_files[0]
    results_file = result_files[0]
    test_bytes = await test_file.read()
    results_bytes = await results_file.read()
    if not test_bytes or not results_bytes:
        raise HTTPException(status_code=400, detail="Faltan archivos o vienen vacíos")

    try:
        assessment = ingest_assessment(
            db,
            course_id=course_id,
            record_id=ids.get("record_id"),
            test_file_name=test_file.filename or "prueba.pdf",
            test_content_type=test_file.content_type,
            test_bytes=test_bytes,
            results_file_name=results_file.filename or "resultados.xlsx",
            results_content_type=results_file.content_type,
            results_bytes=results_bytes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Falló el análisis de la evaluación: {exc}",
        ) from exc
    return assessment, []


def _chat_stream_response(messages: list[dict]) -> StreamingResponse:
    async def event_stream():
        async for event in agent.astream_events(
            {"messages": messages},
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

    return _chat_stream_response([m.model_dump() for m in req.messages])


@app.post("/chat/stream-with-files")
async def chat_stream_with_files(
    messages: str = Form(...),
    files: list[UploadFile] = File([]),
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    try:
        raw_messages = json.loads(messages)
        parsed_messages = [
            ChatMessage.model_validate(message) for message in raw_messages
        ]
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400, detail="Payload de mensajes inválido"
        ) from exc

    if not parsed_messages:
        raise HTTPException(status_code=400, detail="Debes enviar al menos un mensaje")

    message_payloads = [message.model_dump() for message in parsed_messages]
    last_message = parsed_messages[-1]
    if last_message.role != "user":
        raise HTTPException(
            status_code=400,
            detail="Los archivos deben acompañar el último mensaje del usuario",
        )

    last_text = last_message.content if isinstance(last_message.content, str) else ""
    assessment, files = await _maybe_ingest_assessment_from_chat(
        files=files,
        parsed_messages=parsed_messages,
        teacher=teacher,
        db=db,
    )
    if assessment is not None:
        weak_oa_codes = sorted(
            metric.oa_code for metric in assessment.oa_metrics if metric.weak
        )
        weak_summary = ", ".join(weak_oa_codes) if weak_oa_codes else "sin OA débiles"
        assessment_context = (
            f"Assessment ID: {assessment.id}.\n"
            f"Se procesó la evaluación «{assessment.title}» en este turno.\n"
            f"OA débiles detectados: {weak_summary}.\n"
            "Revisa la evaluación con las herramientas de evaluación, cruza con el plan y propone replanificación concreta. No apliques cambios sin confirmación."
        )
        last_text = f"{last_text.strip()}\n\n{assessment_context}".strip()
    else:
        last_text = _augment_followup_with_assessment_context(
            last_text=last_text,
            parsed_messages=parsed_messages,
        )
    message_payloads[-1]["content"] = await build_last_user_message_content(
        last_text,
        files,
    )
    return _chat_stream_response(message_payloads)


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


# ──────────────────────────── Planificación anual (extracción) ────────────────────────────


class PlanItemOut(BaseModel):
    id: int
    ordinal: int
    mes: str | None
    unidad: str | None
    oa_codes: list[str]
    objetivo: str


class PlanOut(BaseModel):
    id: int
    name: str
    asignatura: str | None
    curso: str | None
    anio: int | None
    docente: str | None
    items: list[PlanItemOut]


class PlanSummary(BaseModel):
    id: int
    name: str


def _plan_out(plan: PlanAnual) -> PlanOut:
    return PlanOut(
        id=plan.id,
        name=plan.name,
        asignatura=plan.asignatura,
        curso=plan.curso,
        anio=plan.anio,
        docente=plan.docente,
        items=[
            PlanItemOut(
                id=it.id,
                ordinal=it.ordinal,
                mes=it.mes,
                unidad=it.unidad,
                oa_codes=list(it.oa_codes or []),
                objetivo=it.objetivo,
            )
            for it in plan.items
        ],
    )


class TranscriptionOut(BaseModel):
    text: str


@app.post("/transcribe", response_model=TranscriptionOut)
async def transcribe_endpoint(
    file: UploadFile = File(...),
    teacher: Teacher = Depends(get_current_teacher),
):
    """Transcribe a short audio clip (Spanish) via OpenRouter STT."""
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="Audio vacío")
    try:
        text = await transcribe_audio(
            audio_bytes=audio,
            filename=file.filename,
            content_type=file.content_type,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"Falló la transcripción: {e}"
        ) from e
    return TranscriptionOut(text=text.strip())


@app.post("/planificacion/extract", response_model=PlanOut)
async def extract_planificacion(
    file: UploadFile = File(...),
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Lee un PDF de planificación, extrae su estructura y la persiste como
    `PlanAnual` + `PlanAnualItem`s. El agente UTP edita estos items con sus
    herramientas CRUD."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Sube un archivo .pdf")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    try:
        draft = await asyncio.to_thread(extract_plan_from_pdf, file_bytes)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Falló la extracción: {e}") from e

    plan = PlanAnual(
        teacher_id=teacher.id,
        name=file.filename,
        asignatura=draft.asignatura,
        curso=draft.curso,
        anio=draft.anio,
        docente=draft.docente,
    )
    for ord_, it in enumerate(draft.items):
        plan.items.append(
            PlanAnualItem(
                ordinal=ord_,
                mes=it.mes,
                unidad=it.unidad,
                oa_codes=list(it.oa_codes),
                objetivo=it.objetivo,
            )
        )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _plan_out(plan)


@app.get("/planificacion", response_model=list[PlanSummary])
def list_planificaciones(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(PlanAnual)
        .filter(PlanAnual.teacher_id == teacher.id)
        .order_by(PlanAnual.created_at.desc())
        .all()
    )
    return [PlanSummary(id=r.id, name=r.name) for r in rows]


@app.get("/planificacion/{plan_id}", response_model=PlanOut)
def get_planificacion(
    plan_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = db.get(PlanAnual, plan_id)
    if plan is None or plan.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Planificación no existe")
    return _plan_out(plan)


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


class AssessmentArtifactOut(BaseModel):
    kind: str
    filename: str
    content_type: str | None


class AssessmentQuestionOut(BaseModel):
    ordinal: int
    score_key: str
    prompt: str
    kind: str
    oa_codes: list[str]
    max_points: float | None


class AssessmentResultRowOut(BaseModel):
    student_name: str
    question_scores: dict[str, float]
    total_score: float | None


class AssessmentOaMetricOut(BaseModel):
    oa_code: str
    question_ordinals: list[int]
    mastery_pct: float
    average_score: float
    max_score: float
    student_count: int
    weak: bool
    evidence_summary: str | None


class AssessmentSummaryOut(BaseModel):
    id: int
    course_id: int
    record_id: int | None
    title: str
    status: str
    weak_oa_codes: list[str]
    created_at: datetime


class AssessmentDetailOut(AssessmentSummaryOut):
    artifacts: list[AssessmentArtifactOut]
    questions: list[AssessmentQuestionOut]
    result_rows: list[AssessmentResultRowOut]
    oa_metrics: list[AssessmentOaMetricOut]


def _assessment_summary_out(assessment: Assessment) -> AssessmentSummaryOut:
    return AssessmentSummaryOut(
        id=assessment.id,
        course_id=assessment.course_id,
        record_id=assessment.record_id,
        title=assessment.title,
        status=assessment.status,
        weak_oa_codes=sorted(metric.oa_code for metric in assessment.oa_metrics if metric.weak),
        created_at=assessment.created_at,
    )


def _assessment_detail_out(assessment: Assessment) -> AssessmentDetailOut:
    return AssessmentDetailOut(
        **_assessment_summary_out(assessment).model_dump(),
        artifacts=[
            AssessmentArtifactOut(
                kind=artifact.kind,
                filename=artifact.filename,
                content_type=artifact.content_type,
            )
            for artifact in assessment.artifacts
        ],
        questions=[
            AssessmentQuestionOut(
                ordinal=question.ordinal,
                score_key=question.score_key,
                prompt=question.prompt,
                kind=question.kind,
                oa_codes=list(question.oa_codes or []),
                max_points=question.max_points,
            )
            for question in assessment.questions
        ],
        result_rows=[
            AssessmentResultRowOut(
                student_name=row.student_name,
                question_scores={key: float(value) for key, value in row.question_scores.items()},
                total_score=row.total_score,
            )
            for row in assessment.result_rows
        ],
        oa_metrics=[
            AssessmentOaMetricOut(
                oa_code=metric.oa_code,
                question_ordinals=list(metric.question_ordinals or []),
                mastery_pct=metric.mastery_pct,
                average_score=metric.average_score,
                max_score=metric.max_score,
                student_count=metric.student_count,
                weak=metric.weak,
                evidence_summary=metric.evidence_summary,
            )
            for metric in sorted(
                assessment.oa_metrics,
                key=lambda item: (item.mastery_pct, item.oa_code),
            )
        ],
    )


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


@app.post("/evaluaciones", response_model=AssessmentSummaryOut)
async def upload_assessment(
    course_id: int = Form(...),
    record_id: int | None = Form(None),
    test_pdf: UploadFile = File(...),
    results_file: UploadFile = File(...),
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    course = db.get(Course, course_id)
    if course is None or course.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Curso no existe")
    if record_id is not None:
        record = db.get(ClassLearningRecord, record_id)
        if record is None or record.course_id != course_id:
            raise HTTPException(status_code=404, detail="Registro no existe para este curso")
    if not test_pdf.filename or not test_pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Sube la prueba en PDF")

    results_suffix = (results_file.filename or "").lower()
    if not results_suffix.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(
            status_code=400,
            detail="Los resultados deben venir en XLSX, XLS o CSV",
        )

    test_bytes = await test_pdf.read()
    results_bytes = await results_file.read()
    if not test_bytes or not results_bytes:
        raise HTTPException(status_code=400, detail="Faltan archivos o vienen vacíos")

    try:
        assessment = ingest_assessment(
            db,
            course_id=course_id,
            record_id=record_id,
            test_file_name=test_pdf.filename,
            test_content_type=test_pdf.content_type,
            test_bytes=test_bytes,
            results_file_name=results_file.filename or "resultados.xlsx",
            results_content_type=results_file.content_type,
            results_bytes=results_bytes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Falló el análisis de la evaluación: {exc}",
        ) from exc
    return _assessment_summary_out(assessment)


@app.get("/evaluaciones/by-course/{course_id}", response_model=list[AssessmentSummaryOut])
def list_assessments_by_course(
    course_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    course = db.get(Course, course_id)
    if course is None or course.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Curso no existe")
    rows = (
        db.query(Assessment)
        .filter(Assessment.course_id == course_id)
        .order_by(Assessment.created_at.desc(), Assessment.id.desc())
        .all()
    )
    return [_assessment_summary_out(row) for row in rows]


@app.get("/evaluaciones/{assessment_id}", response_model=AssessmentDetailOut)
def get_assessment(
    assessment_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    assessment = db.get(Assessment, assessment_id)
    if assessment is None or assessment.course.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Evaluación no existe")
    return _assessment_detail_out(assessment)


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
    oa_codes: list[str]


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

    found = db.query(Question.id).filter(Question.id.in_(body.question_ids)).all()
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
        GuiaSummary(
            id=r.id,
            name=r.name,
            question_count=len(r.items),
            oa_codes=_collect_oa_codes(r),
        )
        for r in rows
    ]


def _collect_oa_codes(g: Guia) -> list[str]:
    """Unique OA codes covered by a guía's questions, sorted by trailing number."""
    seen: set[str] = set()
    codes: list[str] = []
    for item in g.items:
        code = item.question.oa_code
        if code and code not in seen:
            seen.add(code)
            codes.append(code)

    def _key(c: str) -> tuple[int, int, str]:
        digits = "".join(ch for ch in c if ch.isdigit())
        return (0, int(digits), c) if digits else (1, 0, c)

    return sorted(codes, key=_key)


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


# ──────────────────────────── Libro de clases ────────────────────────────


class LearningRecordOut(BaseModel):
    id: int
    course_id: int
    course_name: str
    class_date: date
    block_number: int
    registered: bool
    oa_numbers: list[str] | None
    observations: str | None


class LearningRecordUpdate(BaseModel):
    oa_numbers: list[str]
    observations: str | None = None


def _record_out(record: ClassLearningRecord) -> LearningRecordOut:
    return LearningRecordOut(
        id=record.id,
        course_id=record.course_id,
        course_name=record.course.name,
        class_date=record.class_date,
        block_number=record.course.block_number,
        registered=record.registered,
        oa_numbers=list(record.oa_numbers) if record.oa_numbers else None,
        observations=record.observations,
    )


def _block_has_ended(class_date: date, block_number: int, now: datetime) -> bool:
    """A class block of length 1 hour starting at HOUR_SLOTS[block-1] = (7+N):00.

    The block ends at (8+N):00. Mirrors the frontend HOUR_SLOTS layout.
    """
    if class_date < now.date():
        return True
    if class_date > now.date():
        return False
    end_hour = 8 + block_number
    return now.hour >= end_hour


@app.get("/libro-de-clases/pending", response_model=list[LearningRecordOut])
def list_pending_records(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Class sessions whose block has already ended but the teacher hasn't logged."""
    now = DEMO_NOW
    rows = (
        db.query(ClassLearningRecord)
        .join(Course, ClassLearningRecord.course_id == Course.id)
        .filter(
            Course.teacher_id == teacher.id,
            ClassLearningRecord.registered.is_(False),
            ClassLearningRecord.class_date <= now.date(),
        )
        .order_by(ClassLearningRecord.class_date.asc(), Course.block_number.asc())
        .all()
    )
    pending = [
        r for r in rows if _block_has_ended(r.class_date, r.course.block_number, now)
    ]
    return [_record_out(r) for r in pending]


@app.get(
    "/libro-de-clases/by-course/{course_id}",
    response_model=list[LearningRecordOut],
)
def list_course_records(
    course_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    course = db.get(Course, course_id)
    if course is None or course.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Curso no existe")
    rows = (
        db.query(ClassLearningRecord)
        .filter(ClassLearningRecord.course_id == course_id)
        .order_by(ClassLearningRecord.class_date.asc())
        .all()
    )
    return [_record_out(r) for r in rows]


@app.get("/libro-de-clases/{record_id}", response_model=LearningRecordOut)
def get_record(
    record_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    record = db.get(ClassLearningRecord, record_id)
    if record is None or record.course.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Registro no existe")
    return _record_out(record)


@app.put("/libro-de-clases/{record_id}", response_model=LearningRecordOut)
def update_record(
    record_id: int,
    body: LearningRecordUpdate,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    record = db.get(ClassLearningRecord, record_id)
    if record is None or record.course.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Registro no existe")
    record.oa_numbers = body.oa_numbers
    record.observations = body.observations
    record.registered = True
    db.commit()
    db.refresh(record)
    return _record_out(record)
