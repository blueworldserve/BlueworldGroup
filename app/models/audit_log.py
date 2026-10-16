import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class AuditLog(Base):
    """Append-only. No update/delete endpoint exists. Actor fields are copied (no FK) so the trail survives user deletion."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_category_created", "category", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False
    )
    category: Mapped[str] = mapped_column(String(16), nullable=False)  # "critical" | "activity"
    action: Mapped[str] = mapped_column(String(48), nullable=False)
    resource: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_email: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    actor_role: Mapped[str | None] = mapped_column(String(16), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)