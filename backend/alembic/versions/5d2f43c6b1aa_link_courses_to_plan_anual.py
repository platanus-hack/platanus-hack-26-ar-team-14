"""link courses to plan_anual

Revision ID: 5d2f43c6b1aa
Revises: 3520af78d4d0
Create Date: 2026-05-09 23:50:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5d2f43c6b1aa"
down_revision: Union[str, Sequence[str], None] = "3520af78d4d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("plan_anual_id", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_courses_plan_anual_id"), "courses", ["plan_anual_id"], unique=False
    )
    op.create_foreign_key(
        "fk_courses_plan_anual_id_plan_anuales",
        "courses",
        "plan_anuales",
        ["plan_anual_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_courses_plan_anual_id_plan_anuales", "courses", type_="foreignkey"
    )
    op.drop_index(op.f("ix_courses_plan_anual_id"), table_name="courses")
    op.drop_column("courses", "plan_anual_id")
