"""Seed script for the demo: 1 teacher, 1 course (Quinto Básico), 30 students.

Run from the backend directory:
    DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app \\
      uv run python -m scripts.seed_demo

Idempotent: re-running with the same teacher email is a no-op.
"""

from app.auth import hash_password
from app.db import SessionLocal
from app.models import Course, Student, Teacher

TEACHER_NAME = "Ana Pérez"
TEACHER_EMAIL = "ana@demo.cl"
TEACHER_PASSWORD = "123"
COURSE_NAME = "Quinto Básico"

STUDENT_NAMES = [
    "Sofía Martínez",
    "Mateo González",
    "Valentina Rojas",
    "Benjamín Soto",
    "Isidora Fuentes",
    "Joaquín Muñoz",
    "Antonia Vargas",
    "Vicente Castro",
    "Florencia Reyes",
    "Tomás Silva",
    "Catalina Herrera",
    "Maximiliano Pizarro",
    "Emilia Araya",
    "Agustín Bravo",
    "Trinidad Espinoza",
    "Lucas Navarro",
    "Renata Sepúlveda",
    "Diego Cortés",
    "Amanda Riquelme",
    "Martín Gallardo",
    "Josefa Tapia",
    "Sebastián Pino",
    "Magdalena Salinas",
    "Cristóbal Lagos",
    "Javiera Cáceres",
    "Nicolás Ortega",
    "Constanza Morales",
    "Bastián Carrasco",
    "Fernanda Vega",
    "Ignacio Henríquez",
]


def main() -> None:
    assert len(STUDENT_NAMES) == 30, "expected 30 student names"
    assert len(set(STUDENT_NAMES)) == 30, "student names must be unique"

    with SessionLocal() as db:
        teacher = db.query(Teacher).filter_by(email=TEACHER_EMAIL).one_or_none()
        if teacher is not None:
            print(
                f"Teacher {TEACHER_EMAIL} already exists (id={teacher.id}); skipping."
            )
            return

        teacher = Teacher(
            name=TEACHER_NAME,
            email=TEACHER_EMAIL,
            password_hash=hash_password(TEACHER_PASSWORD),
        )
        course = Course(
            name=COURSE_NAME,
            teacher=teacher,
            class_days=["monday", "wednesday", "thursday"],
            block_number=2,
        )
        course.students = [Student(name=n) for n in STUDENT_NAMES]
        db.add(teacher)
        db.commit()
        db.refresh(teacher)
        db.refresh(course)
        print(
            f"Seeded teacher {teacher.email} (id={teacher.id}), "
            f"course {course.name!r} (id={course.id}), "
            f"{len(course.students)} students."
        )


if __name__ == "__main__":
    main()
