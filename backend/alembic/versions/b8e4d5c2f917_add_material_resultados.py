"""add result fields to materials

Revision ID: b8e4d5c2f917
Revises: a7f3c2b1d4e8
Create Date: 2026-05-10 14:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8e4d5c2f917"
down_revision: Union[str, Sequence[str], None] = "a7f3c2b1d4e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("materials", sa.Column("n_alumnos", sa.Integer(), nullable=True))
    op.add_column("materials", sa.Column("promedio", sa.Float(), nullable=True))
    op.add_column("materials", sa.Column("pct_aprobados", sa.Float(), nullable=True))
    op.add_column(
        "materials",
        sa.Column(
            "resultados_uploaded_at", sa.DateTime(timezone=True), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("materials", "resultados_uploaded_at")
    op.drop_column("materials", "pct_aprobados")
    op.drop_column("materials", "promedio")
    op.drop_column("materials", "n_alumnos")
