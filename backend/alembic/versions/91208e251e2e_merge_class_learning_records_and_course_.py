"""merge class_learning_records and course_block_number heads

Revision ID: 91208e251e2e
Revises: 9a8b7c6d5e4f, a1b2c3d4e5f6
Create Date: 2026-05-09 23:06:02.284740

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '91208e251e2e'
down_revision: Union[str, Sequence[str], None] = ('9a8b7c6d5e4f', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
