import uuid

from sqlalchemy import String, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from db.base import Base


class CountryShowcase(Base):
    """The photo + write-up shown when a visitor taps a country marker on the
    homepage globe. `name` must match a REACH_MARKERS entry in the frontend's
    placeholder-content.ts exactly (case-insensitive) — that's how the globe
    marker click gets linked back to the right row here."""

    __tablename__ = "country_showcases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    place: Mapped[str] = mapped_column(String, nullable=False)
    headline: Mapped[str] = mapped_column(String, nullable=False)
    blurb: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    stat_value: Mapped[str] = mapped_column(String, nullable=False)
    stat_label: Mapped[str] = mapped_column(String, nullable=False)
    points: Mapped[list] = mapped_column(JSON, default=list)
    image: Mapped[str | None] = mapped_column(String, nullable=True)
    video: Mapped[str | None] = mapped_column(String, nullable=True)
    tint: Mapped[str | None] = mapped_column(String, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)