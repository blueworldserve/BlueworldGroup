"""add read_more_url to business_units

Revision ID: 7c1e5a9d2b40
Revises: 3b0afc88bedf
Create Date: 2026-11-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c1e5a9d2b40'
down_revision: Union[str, None] = '3b0afc88bedf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('business_units', sa.Column('read_more_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('business_units', 'read_more_url')
