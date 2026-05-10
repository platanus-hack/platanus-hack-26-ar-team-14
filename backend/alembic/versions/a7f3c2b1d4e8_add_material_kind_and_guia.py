"""add kind and guia_id to materials

Revision ID: a7f3c2b1d4e8
Revises: d8e9f0a1b2c3
Create Date: 2026-05-10 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7f3c2b1d4e8"
down_revision: Union[str, Sequence[str], None] = "d8e9f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "materials",
        sa.Column("kind", sa.String(length=32), nullable=False, server_default="guia"),
    )
    op.add_column(
        "materials",
        sa.Column("guia_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_materials_guia_id",
        "materials",
        "guias",
        ["guia_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_materials_guia_id"), "materials", ["guia_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_materials_guia_id"), table_name="materials")
    op.drop_constraint("fk_materials_guia_id", "materials", type_="foreignkey")
    op.drop_column("materials", "guia_id")
    op.drop_column("materials", "kind")
