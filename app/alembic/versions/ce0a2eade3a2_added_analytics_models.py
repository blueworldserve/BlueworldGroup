"""Added analytics models

Revision ID: ce0a2eade3a2
Revises: ebd764e4a2a3
Create Date: 2026-11-02 11:12:11.993901

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'ce0a2eade3a2'
down_revision: Union[str, None] = 'ebd764e4a2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'analytics_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('visitor_id', sa.String(length=40), nullable=False),
        sa.Column('session_id', sa.String(length=40), nullable=False),
        sa.Column('kind', sa.String(length=12), nullable=False),
        sa.Column('path', sa.String(length=200), nullable=False),
        sa.Column('label', sa.String(length=120), nullable=True),
        sa.Column('target', sa.String(length=200), nullable=True),
        sa.Column('section', sa.String(length=60), nullable=True),
        sa.Column('referrer', sa.String(length=120), nullable=True),
        sa.Column('device', sa.String(length=10), nullable=True),
        sa.Column('country', sa.String(length=2), nullable=True),
        sa.Column('duration_s', sa.Integer(), nullable=True),
        sa.Column('scroll_pct', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_analytics_events_created_at', 'analytics_events', ['created_at'])
    op.create_index('ix_analytics_events_visitor_id', 'analytics_events', ['visitor_id'])
    op.create_index('ix_analytics_kind_created', 'analytics_events', ['kind', 'created_at'])
    op.create_index('ix_analytics_path_created', 'analytics_events', ['path', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_analytics_path_created', table_name='analytics_events')
    op.drop_index('ix_analytics_kind_created', table_name='analytics_events')
    op.drop_index('ix_analytics_events_visitor_id', table_name='analytics_events')
    op.drop_index('ix_analytics_events_created_at', table_name='analytics_events')
    op.drop_table('analytics_events')