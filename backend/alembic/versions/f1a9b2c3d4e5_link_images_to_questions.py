"""link worksheet images to questions

Revision ID: f1a9b2c3d4e5
Revises: e2880a786d4e
Create Date: 2026-05-09 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a9b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "e2880a786d4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "worksheet_images",
        sa.Column("question_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_worksheet_images_question_id_worksheet_questions",
        "worksheet_images",
        "worksheet_questions",
        ["question_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_worksheet_images_question_id"),
        "worksheet_images",
        ["question_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_worksheet_images_question_id"), table_name="worksheet_images"
    )
    op.drop_constraint(
        "fk_worksheet_images_question_id_worksheet_questions",
        "worksheet_images",
        type_="foreignkey",
    )
    op.drop_column("worksheet_images", "question_id")
