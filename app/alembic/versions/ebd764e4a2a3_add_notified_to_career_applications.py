"""Add Notified_to_career_applications

Revision ID: ebd764e4a2a3
Revises: f2df04971412
Create Date: 2026-10-27 21:04:20.634751

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ebd764e4a2a3'
down_revision: Union[str, None] = 'f2df04971412'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('career_applications', sa.Column('notified_at', sa.DateTime(timezone=True), nullable=True))
    # Applications that already exist were seen in the CMS before this feature, so don't announce them again.
    op.execute("UPDATE career_applications SET notified_at = now()")


def downgrade() -> None:
    op.drop_column('career_applications', 'notified_at')
