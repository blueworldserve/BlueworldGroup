"""Reviewing how applicants apply for job roles

Revision ID: f2df04971412
Revises: 14d85ba671c2
Create Date: 2026-10-26 22:49:19.287831

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2df04971412'
down_revision: Union[str, None] = '14d85ba671c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("career_applications", sa.Column("status", sa.String(), nullable=False, server_default="new"))
    op.add_column("career_applications", sa.Column("interview_date", sa.Date(), nullable=True))
    op.add_column("career_applications", sa.Column("interview_time", sa.String(), nullable=True))
    op.add_column("career_applications", sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("career_applications", sa.Column("decided_by", sa.String(), nullable=True))
    op.add_column("career_applications", sa.Column("decision_subject", sa.String(), nullable=True))
    op.add_column("career_applications", sa.Column("decision_body", sa.Text(), nullable=True))


def downgrade() -> None:
    for col in ("decision_body", "decision_subject", "decided_by", "decided_at", "interview_time", "interview_date", "status"):
        op.drop_column("career_applications", col)