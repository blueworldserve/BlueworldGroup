"""inbound email: contact threads can start from / continue with emails read over IMAP

Revision ID: b8e4f2a91c63
Revises: a7d3c9e41b52
Create Date: 2026-11-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8e4f2a91c63'
down_revision: Union[str, None] = 'a7d3c9e41b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contact_submissions', sa.Column('source', sa.String(), nullable=False, server_default='website'))
    op.add_column('contact_submissions', sa.Column('mailbox', sa.String(), nullable=True))
    op.add_column('contact_submissions', sa.Column('message_id', sa.String(), nullable=True))
    op.create_unique_constraint('uq_contact_submissions_message_id', 'contact_submissions', ['message_id'])
    op.add_column('contact_replies', sa.Column('direction', sa.String(), nullable=False, server_default='out'))
    op.add_column('contact_replies', sa.Column('message_id', sa.String(), nullable=True))
    op.create_unique_constraint('uq_contact_replies_message_id', 'contact_replies', ['message_id'])


def downgrade() -> None:
    op.drop_constraint('uq_contact_replies_message_id', 'contact_replies', type_='unique')
    op.drop_column('contact_replies', 'message_id')
    op.drop_column('contact_replies', 'direction')
    op.drop_constraint('uq_contact_submissions_message_id', 'contact_submissions', type_='unique')
    op.drop_column('contact_submissions', 'message_id')
    op.drop_column('contact_submissions', 'mailbox')
    op.drop_column('contact_submissions', 'source')
