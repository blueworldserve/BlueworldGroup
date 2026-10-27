"""check resume table

Revision ID: 14d85ba671c2
Revises: 6be6bf72ffd6
Create Date: 2026-10-21 16:49:20.085132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14d85ba671c2'
down_revision: Union[str, None] = '6be6bf72ffd6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Table was already created in 6be6bf72ffd6. Only align created_at with the model.
    op.execute(
        "UPDATE career_application_files SET created_at = now() WHERE created_at IS NULL"
    )
    op.alter_column(
        'career_application_files',
        'created_at',
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'career_application_files',
        'created_at',
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
