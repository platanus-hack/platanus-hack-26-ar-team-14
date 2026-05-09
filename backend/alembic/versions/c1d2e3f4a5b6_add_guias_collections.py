"""add guias and guia_items (teacher-built question collections)

Revision ID: c1d2e3f4a5b6
Revises: b4d5e6f7a8b9
Create Date: 2026-05-09 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "b4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "guias",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_guias_teacher_id"), "guias", ["teacher_id"])

    op.create_table(
        "guia_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("guia_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["guia_id"], ["guias.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["question_id"], ["questions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_guia_items_guia_id"), "guia_items", ["guia_id"]
    )
    op.create_index(
        op.f("ix_guia_items_question_id"), "guia_items", ["question_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_guia_items_question_id"), table_name="guia_items")
    op.drop_index(op.f("ix_guia_items_guia_id"), table_name="guia_items")
    op.drop_table("guia_items")
    op.drop_index(op.f("ix_guias_teacher_id"), table_name="guias")
    op.drop_table("guias")
