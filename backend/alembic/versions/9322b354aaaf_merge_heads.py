"""merge heads

Revision ID: 9322b354aaaf
Revises: 5d2f43c6b1aa, b2c3d4e5f6a7
Create Date: 2026-05-10 00:19:59.043505

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "9322b354aaaf"
down_revision: Union[str, Sequence[str], None] = ("5d2f43c6b1aa", "b2c3d4e5f6a7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
