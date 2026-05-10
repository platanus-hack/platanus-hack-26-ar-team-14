"""add generated guia questions

Revision ID: f0a1b2c3d4e6
Revises: e7f8a9b0c1d2
Create Date: 2026-05-10 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f0a1b2c3d4e6"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generated_guia_questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("guia_id", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column(
            "kind", sa.String(length=32), nullable=False, server_default="open"
        ),
        sa.Column("alternatives", sa.JSON(), nullable=True),
        sa.Column("correct_alternative", sa.String(length=8), nullable=True),
        sa.Column("oa_code", sa.String(length=16), nullable=True),
        sa.Column("habilidad", sa.String(length=255), nullable=True),
        sa.Column("contenido", sa.String(length=255), nullable=True),
        sa.Column("source_note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["guia_id"], ["guias.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_generated_guia_questions_guia_id"),
        "generated_guia_questions",
        ["guia_id"],
    )
    op.create_index(
        op.f("ix_generated_guia_questions_ordinal"),
        "generated_guia_questions",
        ["ordinal"],
    )
    op.create_index(
        op.f("ix_generated_guia_questions_oa_code"),
        "generated_guia_questions",
        ["oa_code"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_generated_guia_questions_oa_code"),
        table_name="generated_guia_questions",
    )
    op.drop_index(
        op.f("ix_generated_guia_questions_ordinal"),
        table_name="generated_guia_questions",
    )
    op.drop_index(
        op.f("ix_generated_guia_questions_guia_id"),
        table_name="generated_guia_questions",
    )
    op.drop_table("generated_guia_questions")
