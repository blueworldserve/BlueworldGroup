"""add slug and is_featured to team_members

Revision ID: 9d7a2fe55a4c
Revises: 243f4c6a1bfa
Create Date: 2026-10-06 08:42:03.731698

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d7a2fe55a4c'
down_revision: Union[str, None] = '243f4c6a1bfa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('team_members', sa.Column('slug', sa.String(), nullable=True))
    op.create_unique_constraint('uq_team_members_slug', 'team_members', ['slug'])
    op.add_column(
        'team_members',
        sa.Column('is_featured', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('team_members', 'is_featured')
    op.drop_constraint('uq_team_members_slug', 'team_members', type_='unique')
    op.drop_column('team_members', 'slug')