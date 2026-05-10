"""drop cantidad_clases from plan_anual_items

Revision ID: b2c3d4e5f6a7
Revises: 3520af78d4d0
Create Date: 2026-05-09 22:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "3520af78d4d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("plan_anual_items", "cantidad_clases")


def downgrade() -> None:
    op.add_column(
        "plan_anual_items",
        sa.Column("cantidad_clases", sa.Integer(), nullable=True),
    )
