"""SQLAlchemy ORM models.

Add new tables here so Alembic autogenerate can pick them up.
"""

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    JSON,
    Date,
    DateTime,
    Float,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    courses: Mapped[list["Course"]] = relationship(
        back_populates="teacher", cascade="all, delete-orphan"
    )


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), index=True
    )
    # Days the class meets: list of lowercase English weekday names
    # (e.g. ["monday", "wednesday", "thursday"]).
    class_days: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    # Time block number (1-based) within the school day when this course meets.
    # Matches the frontend HOUR_SLOTS index (block 1 = first slot, etc.).
    block_number: Mapped[int] = mapped_column(default=1, server_default="1")
    plan_anual_id: Mapped[int | None] = mapped_column(
        ForeignKey("plan_anuales.id", ondelete="SET NULL"), nullable=True, index=True
    )

    teacher: Mapped["Teacher"] = relationship(back_populates="courses")
    plan_anual: Mapped["PlanAnual | None"] = relationship(back_populates="courses")
    students: Mapped[list["Student"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    learning_records: Mapped[list["ClassLearningRecord"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    assessments: Mapped[list["Assessment"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )

    course: Mapped["Course"] = relationship(back_populates="students")


class ClassLearningRecord(Base):
    """What was taught and observed in a concrete course block on a given date.

    We currently link this to Course because the weekly schedule abstraction in the
    backend lives on courses via class_days + block_number rather than a separate
    horario table.
    """

    __tablename__ = "class_learning_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    class_date: Mapped[date] = mapped_column(Date, index=True)
    registered: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    oa_numbers: Mapped[list | None] = mapped_column(JSON, nullable=True)
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)

    course: Mapped["Course"] = relationship(back_populates="learning_records")
    assessments: Mapped[list["Assessment"]] = relationship(
        back_populates="record", cascade="all, delete-orphan"
    )


class Alert(Base):
    """Alerta sobre un curso: severidad y observaciones que la motivan."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    severity: Mapped[str] = mapped_column(String(16))
    observations: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    course: Mapped["Course"] = relationship(back_populates="alerts")


class Question(Base):
    """A single exercise extracted from a teacher-uploaded PDF.

    Flat row designed for a question bank: each question carries its own
    curriculum metadata (so we can filter/pick) and an optional inline image.
    The worksheet builder will compose new guías by selecting rows from here.
    """

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)

    prompt: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 'open' for free-response, 'multiple_choice' if the question has alternatives.
    kind: Mapped[str] = mapped_column(String(32), default="open", server_default="open")
    # For multiple_choice: list of {"label": "a", "text": "..."}.
    alternatives: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Label of the correct alternative ("a", "b", …) when known.
    correct_alternative: Mapped[str | None] = mapped_column(String(8), nullable=True)

    asignatura: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    nivel: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    oa_code: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    habilidad: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contenido: Mapped[str | None] = mapped_column(String(255), nullable=True)

    source_file: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )

    image_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    image_mime: Mapped[str | None] = mapped_column(String(64), nullable=True)
    image_width: Mapped[int | None] = mapped_column(nullable=True)
    image_height: Mapped[int | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Guia(Base):
    """A teacher-built guía: a named, ordered collection of questions."""

    __tablename__ = "guias"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    teacher: Mapped["Teacher"] = relationship()
    items: Mapped[list["GuiaItem"]] = relationship(
        back_populates="guia",
        cascade="all, delete-orphan",
        order_by="GuiaItem.ordinal",
    )
    generated_questions: Mapped[list["GeneratedGuiaQuestion"]] = relationship(
        back_populates="guia",
        cascade="all, delete-orphan",
        order_by="GeneratedGuiaQuestion.ordinal",
    )


class GuiaItem(Base):
    """Ordered link from a guía to a question (no duplication of text)."""

    __tablename__ = "guia_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    guia_id: Mapped[int] = mapped_column(
        ForeignKey("guias.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    ordinal: Mapped[int] = mapped_column()

    guia: Mapped["Guia"] = relationship(back_populates="items")
    question: Mapped["Question"] = relationship()


class GeneratedGuiaQuestion(Base):
    """Guide-only generated question that should not enter the global bank."""

    __tablename__ = "generated_guia_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    guia_id: Mapped[int] = mapped_column(
        ForeignKey("guias.id", ondelete="CASCADE"), index=True
    )
    ordinal: Mapped[int] = mapped_column(index=True)

    prompt: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(32), default="open", server_default="open")
    alternatives: Mapped[list | None] = mapped_column(JSON, nullable=True)
    correct_alternative: Mapped[str | None] = mapped_column(String(8), nullable=True)

    oa_code: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    habilidad: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contenido: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    guia: Mapped["Guia"] = relationship(back_populates="generated_questions")


class Assessment(Base):
    """Uploaded test evidence tied to a course and used for replanning."""

    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    record_id: Mapped[int | None] = mapped_column(
        ForeignKey("class_learning_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(
        String(32), default="ready", server_default="ready"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    course: Mapped["Course"] = relationship(back_populates="assessments")
    record: Mapped["ClassLearningRecord | None"] = relationship(
        back_populates="assessments"
    )
    artifacts: Mapped[list["AssessmentArtifact"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan"
    )
    questions: Mapped[list["AssessmentQuestion"]] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="AssessmentQuestion.ordinal",
    )
    result_rows: Mapped[list["AssessmentResultRow"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan"
    )
    oa_metrics: Mapped[list["AssessmentOaMetric"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan"
    )


class AssessmentArtifact(Base):
    """Binary files stored for an assessment upload."""

    __tablename__ = "assessment_artifacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(32))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)

    assessment: Mapped["Assessment"] = relationship(back_populates="artifacts")


class AssessmentQuestion(Base):
    """Question-level structure extracted from a test PDF."""

    __tablename__ = "assessment_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    ordinal: Mapped[int] = mapped_column(index=True)
    score_key: Mapped[str] = mapped_column(String(32))
    prompt: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(32), default="open", server_default="open")
    oa_codes: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    max_points: Mapped[float | None] = mapped_column(Float, nullable=True)

    assessment: Mapped["Assessment"] = relationship(back_populates="questions")


class AssessmentResultRow(Base):
    """Normalized per-student scores extracted from a spreadsheet upload."""

    __tablename__ = "assessment_result_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    student_name: Mapped[str] = mapped_column(String(255))
    question_scores: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    total_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    assessment: Mapped["Assessment"] = relationship(back_populates="result_rows")


class AssessmentOaMetric(Base):
    """Aggregated mastery signal for a single OA inside one assessment."""

    __tablename__ = "assessment_oa_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    oa_code: Mapped[str] = mapped_column(String(16), index=True)
    question_ordinals: Mapped[list] = mapped_column(
        JSON, default=list, server_default="[]"
    )
    mastery_pct: Mapped[float] = mapped_column(Float)
    average_score: Mapped[float] = mapped_column(Float)
    max_score: Mapped[float] = mapped_column(Float)
    student_count: Mapped[int] = mapped_column()
    weak: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), index=True
    )
    evidence_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    assessment: Mapped["Assessment"] = relationship(back_populates="oa_metrics")


class Material(Base):
    """Material vinculado a un PlanAnualItem (guía, prueba, recurso, etc.)."""

    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PlanAnual(Base):
    """Planificación anual del docente. Cabecera con nombre y items."""

    __tablename__ = "plan_anuales"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    asignatura: Mapped[str | None] = mapped_column(String(64), nullable=True)
    curso: Mapped[str | None] = mapped_column(String(64), nullable=True)
    anio: Mapped[int | None] = mapped_column(nullable=True)
    docente: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[list["PlanAnualItem"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanAnualItem.ordinal",
    )
    courses: Mapped[list["Course"]] = relationship(back_populates="plan_anual")


class PlanAnualItem(Base):
    """Fila de la planificación anual editable por el agente UTP."""

    __tablename__ = "plan_anual_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_anual_id: Mapped[int] = mapped_column(
        ForeignKey("plan_anuales.id", ondelete="CASCADE"), index=True
    )
    ordinal: Mapped[int] = mapped_column(default=0)
    mes: Mapped[str | None] = mapped_column(String(32), nullable=True)
    unidad: Mapped[str | None] = mapped_column(String(64), nullable=True)
    oa_codes: Mapped[list] = mapped_column(JSON, default=list)
    objetivo: Mapped[str] = mapped_column(Text, default="")
    material_id: Mapped[int | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), nullable=True, index=True
    )

    plan: Mapped["PlanAnual"] = relationship(back_populates="items")
    material: Mapped["Material | None"] = relationship()
