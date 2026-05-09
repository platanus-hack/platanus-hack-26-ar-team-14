"""add worksheets tables

Revision ID: e2880a786d4e
Revises: 485927322673
Create Date: 2026-05-09 20:04:49.274392

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2880a786d4e"
down_revision: Union[str, Sequence[str], None] = "485927322673"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "worksheets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=512), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("titulo", sa.String(length=512), nullable=True),
        sa.Column("asignatura", sa.String(length=255), nullable=True),
        sa.Column("nivel", sa.String(length=64), nullable=True),
        sa.Column("profesor", sa.String(length=255), nullable=True),
        sa.Column("unidad", sa.String(length=255), nullable=True),
        sa.Column("objetivo", sa.Text(), nullable=True),
        sa.Column("oa_code", sa.String(length=16), nullable=True),
        sa.Column("habilidades", sa.Text(), nullable=True),
        sa.Column("contenido", sa.Text(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_worksheets_file_hash"), "worksheets", ["file_hash"], unique=True
    )
    op.create_index(op.f("ix_worksheets_oa_code"), "worksheets", ["oa_code"])

    op.create_table(
        "worksheet_activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("worksheet_id", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["worksheet_id"], ["worksheets.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_worksheet_activities_worksheet_id"),
        "worksheet_activities",
        ["worksheet_id"],
    )

    op.create_table(
        "worksheet_questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("activity_id", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=16), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["activity_id"], ["worksheet_activities.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_worksheet_questions_activity_id"),
        "worksheet_questions",
        ["activity_id"],
    )

    op.create_table(
        "worksheet_images",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("worksheet_id", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.ForeignKeyConstraint(
            ["worksheet_id"], ["worksheets.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_worksheet_images_worksheet_id"),
        "worksheet_images",
        ["worksheet_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_worksheet_images_worksheet_id"), table_name="worksheet_images")
    op.drop_table("worksheet_images")
    op.drop_index(
        op.f("ix_worksheet_questions_activity_id"), table_name="worksheet_questions"
    )
    op.drop_table("worksheet_questions")
    op.drop_index(
        op.f("ix_worksheet_activities_worksheet_id"),
        table_name="worksheet_activities",
    )
    op.drop_table("worksheet_activities")
    op.drop_index(op.f("ix_worksheets_oa_code"), table_name="worksheets")
    op.drop_index(op.f("ix_worksheets_file_hash"), table_name="worksheets")
    op.drop_table("worksheets")
