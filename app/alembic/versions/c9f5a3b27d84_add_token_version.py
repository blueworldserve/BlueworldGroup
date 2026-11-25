"""admin_users.token_version: lets logout, suspension and password resets cancel issued login tokens

Revision ID: c9f5a3b27d84
Revises: b8e4f2a91c63
Create Date: 2026-11-21 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9f5a3b27d84'
down_revision: Union[str, None] = 'b8e4f2a91c63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("admin_users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("admin_users", "token_version")
