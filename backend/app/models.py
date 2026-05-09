"""SQLAlchemy ORM models.

Add new tables here so Alembic autogenerate can pick them up.
"""

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    Text,
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

    teacher: Mapped["Teacher"] = relationship(back_populates="courses")
    students: Mapped[list["Student"]] = relationship(
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


class Material(Base):
    """Material vinculado a un PlanAnualItem (guía, prueba, recurso, etc.)."""

    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PlanAnual(Base):
    """Planificación anual: cabecera con nombre y fecha."""

    __tablename__ = "plan_anuales"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    fecha: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[list["PlanAnualItem"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
    )


class PlanAnualItem(Base):
    """Fila de la planificación anual: mes + OA + cantidad de clases + material."""

    __tablename__ = "plan_anual_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_anual_id: Mapped[int] = mapped_column(
        ForeignKey("plan_anuales.id", ondelete="CASCADE"), index=True
    )
    mes: Mapped[str] = mapped_column(String(32))
    oa: Mapped[str] = mapped_column(String(16), index=True)
    cantidad_clases: Mapped[int] = mapped_column()
    material_id: Mapped[int | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), nullable=True, index=True
    )

    plan: Mapped["PlanAnual"] = relationship(back_populates="items")
    material: Mapped["Material | None"] = relationship()
