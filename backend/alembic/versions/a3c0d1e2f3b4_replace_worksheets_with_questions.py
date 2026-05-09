"""replace worksheet hierarchy with flat questions table

Revision ID: a3c0d1e2f3b4
Revises: f1a9b2c3d4e5
Create Date: 2026-05-09 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3c0d1e2f3b4"
down_revision: Union[str, Sequence[str], None] = "f1a9b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the per-PDF hierarchy — we now store a flat question bank.
    op.drop_table("worksheet_images")
    op.drop_table("worksheet_questions")
    op.drop_table("worksheet_activities")
    op.drop_table("worksheets")

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("asignatura", sa.String(length=64), nullable=True),
        sa.Column("nivel", sa.String(length=64), nullable=True),
        sa.Column("oa_code", sa.String(length=16), nullable=True),
        sa.Column("habilidad", sa.String(length=255), nullable=True),
        sa.Column("contenido", sa.String(length=255), nullable=True),
        sa.Column("source_file", sa.String(length=512), nullable=True),
        sa.Column("source_hash", sa.String(length=64), nullable=True),
        sa.Column("image_data", sa.LargeBinary(), nullable=True),
        sa.Column("image_mime", sa.String(length=64), nullable=True),
        sa.Column("image_width", sa.Integer(), nullable=True),
        sa.Column("image_height", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_questions_asignatura"), "questions", ["asignatura"])
    op.create_index(op.f("ix_questions_nivel"), "questions", ["nivel"])
    op.create_index(op.f("ix_questions_oa_code"), "questions", ["oa_code"])
    op.create_index(op.f("ix_questions_source_hash"), "questions", ["source_hash"])


def downgrade() -> None:
    op.drop_index(op.f("ix_questions_source_hash"), table_name="questions")
    op.drop_index(op.f("ix_questions_oa_code"), table_name="questions")
    op.drop_index(op.f("ix_questions_nivel"), table_name="questions")
    op.drop_index(op.f("ix_questions_asignatura"), table_name="questions")
    op.drop_table("questions")
    # NOTE: original worksheet hierarchy is not recreated here; if you need to
    # roll back below this revision, restore from the snapshot taken before
    # this migration ran.
