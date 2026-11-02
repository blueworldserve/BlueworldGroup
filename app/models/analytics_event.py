import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class AnalyticsEvent(Base):
    """One thing a public visitor did: viewed a page, clicked something, or left a page.

    Privacy by design: no IP address, no name, no email. `visitor_id` is a random id the browser
    makes up for itself, so we can count people without knowing who they are.
    """

    __tablename__ = "analytics_events"
    __table_args__ = (
        Index("ix_analytics_kind_created", "kind", "created_at"),
        Index("ix_analytics_path_created", "path", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False
    )
    visitor_id: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    session_id: Mapped[str] = mapped_column(String(40), nullable=False)
    kind: Mapped[str] = mapped_column(String(12), nullable=False)  # "pageview" | "click" | "leave"
    path: Mapped[str] = mapped_column(String(200), nullable=False)
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    target: Mapped[str | None] = mapped_column(String(200), nullable=True)
    section: Mapped[str | None] = mapped_column(String(60), nullable=True)
    referrer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    device: Mapped[str | None] = mapped_column(String(10), nullable=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    duration_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scroll_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)