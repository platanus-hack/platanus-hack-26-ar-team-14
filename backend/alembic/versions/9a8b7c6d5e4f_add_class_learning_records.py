"""add class learning records

Revision ID: 9a8b7c6d5e4f
Revises: e5b6c7d8e9f0
Create Date: 2026-05-09 23:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9a8b7c6d5e4f"
down_revision: Union[str, Sequence[str], None] = "e5b6c7d8e9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "class_learning_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("class_date", sa.Date(), nullable=False),
        sa.Column(
            "registered", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("oa_numbers", sa.JSON(), nullable=True),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("course_id", "class_date"),
    )
    op.create_index(
        op.f("ix_class_learning_records_course_id"),
        "class_learning_records",
        ["course_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_class_learning_records_class_date"),
        "class_learning_records",
        ["class_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_class_learning_records_class_date"),
        table_name="class_learning_records",
    )
    op.drop_index(
        op.f("ix_class_learning_records_course_id"),
        table_name="class_learning_records",
    )
    op.drop_table("class_learning_records")
