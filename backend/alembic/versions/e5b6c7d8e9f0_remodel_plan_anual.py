"""remodel plan_anual to match extraction shape and add teacher_id

Revision ID: e5b6c7d8e9f0
Revises: 3f041ca8d7b7
Create Date: 2026-05-09 19:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5b6c7d8e9f0"
down_revision: Union[str, Sequence[str], None] = "3f041ca8d7b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(
        op.f("ix_plan_anual_items_plan_anual_id"), table_name="plan_anual_items"
    )
    op.drop_index(op.f("ix_plan_anual_items_oa"), table_name="plan_anual_items")
    op.drop_index(
        op.f("ix_plan_anual_items_material_id"), table_name="plan_anual_items"
    )
    op.drop_table("plan_anual_items")
    op.drop_table("plan_anuales")

    op.create_table(
        "plan_anuales",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("asignatura", sa.String(length=64), nullable=True),
        sa.Column("curso", sa.String(length=64), nullable=True),
        sa.Column("anio", sa.Integer(), nullable=True),
        sa.Column("docente", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_plan_anuales_teacher_id"), "plan_anuales", ["teacher_id"], unique=False
    )

    op.create_table(
        "plan_anual_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plan_anual_id", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mes", sa.String(length=32), nullable=True),
        sa.Column("unidad", sa.String(length=64), nullable=True),
        sa.Column("oa_codes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("objetivo", sa.Text(), nullable=False, server_default=""),
        sa.Column("cantidad_clases", sa.Integer(), nullable=True),
        sa.Column("material_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["plan_anual_id"], ["plan_anuales.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_plan_anual_items_plan_anual_id"),
        "plan_anual_items",
        ["plan_anual_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_plan_anual_items_material_id"),
        "plan_anual_items",
        ["material_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_plan_anual_items_material_id"), table_name="plan_anual_items"
    )
    op.drop_index(
        op.f("ix_plan_anual_items_plan_anual_id"), table_name="plan_anual_items"
    )
    op.drop_table("plan_anual_items")
    op.drop_index(op.f("ix_plan_anuales_teacher_id"), table_name="plan_anuales")
    op.drop_table("plan_anuales")

    op.create_table(
        "plan_anuales",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "plan_anual_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plan_anual_id", sa.Integer(), nullable=False),
        sa.Column("mes", sa.String(length=32), nullable=False),
        sa.Column("oa", sa.String(length=16), nullable=False),
        sa.Column("cantidad_clases", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["plan_anual_id"], ["plan_anuales.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_plan_anual_items_material_id"),
        "plan_anual_items",
        ["material_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_plan_anual_items_oa"), "plan_anual_items", ["oa"], unique=False
    )
    op.create_index(
        op.f("ix_plan_anual_items_plan_anual_id"),
        "plan_anual_items",
        ["plan_anual_id"],
        unique=False,
    )
