"""add multiple-choice alternatives to questions

Revision ID: b4d5e6f7a8b9
Revises: a3c0d1e2f3b4
Create Date: 2026-05-09 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "a3c0d1e2f3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column(
            "kind",
            sa.String(length=32),
            server_default="open",
            nullable=False,
        ),
    )
    op.add_column(
        "questions",
        sa.Column("alternatives", sa.JSON(), nullable=True),
    )
    op.add_column(
        "questions",
        sa.Column("correct_alternative", sa.String(length=8), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("questions", "correct_alternative")
    op.drop_column("questions", "alternatives")
    op.drop_column("questions", "kind")
