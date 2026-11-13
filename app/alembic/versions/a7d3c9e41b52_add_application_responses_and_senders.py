"""add application_responses, sender columns

Revision ID: a7d3c9e41b52
Revises: 7c1e5a9d2b40
Create Date: 2026-11-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a7d3c9e41b52'
down_revision: Union[str, None] = '7c1e5a9d2b40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contact_replies', sa.Column('from_email', sa.String(), nullable=True))
    op.add_column('career_applications', sa.Column('decision_from', sa.String(), nullable=True))
    op.create_table(
        'application_responses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('career_applications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('from_email', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False, server_default=''),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('message_id', sa.String(), nullable=False),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.UniqueConstraint('message_id', name='uq_application_responses_message_id'),
    )
    op.create_index('ix_application_responses_application_id', 'application_responses', ['application_id'])


def downgrade() -> None:
    op.drop_index('ix_application_responses_application_id', table_name='application_responses')
    op.drop_table('application_responses')
    op.drop_column('career_applications', 'decision_from')
    op.drop_column('contact_replies', 'from_email')
