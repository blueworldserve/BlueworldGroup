import re
from typing import Literal

from pydantic import Field, field_validator

from schemas.base import CamelModel

_ID = re.compile(r"^[A-Za-z0-9_-]{8,40}$")
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def _clean(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    value = _CONTROL.sub("", value).strip()
    return value[:limit] or None


class EventIn(CamelModel):
    kind: Literal["pageview", "click", "leave"]
    path: str = Field(min_length=1, max_length=300)
    label: str | None = Field(None, max_length=300)
    target: str | None = Field(None, max_length=300)
    section: str | None = Field(None, max_length=100)
    referrer: str | None = Field(None, max_length=300)
    device: Literal["mobile", "tablet", "desktop"] | None = None
    duration_s: int | None = Field(None, ge=0, le=6 * 3600)
    scroll_pct: int | None = Field(None, ge=0, le=100)

    @field_validator("path")
    @classmethod
    def _path(cls, v: str) -> str:
        v = v.split("?", 1)[0].split("#", 1)[0].strip()
        if not v.startswith("/"):
            raise ValueError("path must start with /")
        if len(v) > 1:
            v = v.rstrip("/")
        return _clean(v, 200) or "/"


class CollectIn(CamelModel):
    visitor_id: str
    session_id: str
    events: list[EventIn] = Field(min_length=1, max_length=20)

    @field_validator("visitor_id", "session_id")
    @classmethod
    def _ids(cls, v: str) -> str:
        if not _ID.match(v):
            raise ValueError("bad id")
        return v


# ---------------------------------------------------------------- admin summary
class Totals(CamelModel):
    visitors: int
    returning_visitors: int
    sessions: int
    pageviews: int
    clicks: int
    avg_seconds_on_page: int
    pages_per_session: float


class DayPoint(CamelModel):
    date: str
    visitors: int
    pageviews: int


class PageRow(CamelModel):
    path: str
    views: int
    visitors: int
    avg_seconds: int
    avg_scroll: int


class ClickRow(CamelModel):
    label: str
    target: str | None = None
    section: str | None = None
    clicks: int
    visitors: int


class NameCount(CamelModel):
    name: str
    count: int


class Conversions(CamelModel):
    contact_messages: int
    newsletter_signups: int
    job_applications: int


class AnalyticsSummary(CamelModel):
    since: str
    until: str
    totals: Totals
    daily: list[DayPoint]
    top_pages: list[PageRow]
    top_clicks: list[ClickRow]
    sections: list[NameCount]
    referrers: list[NameCount]
    devices: list[NameCount]
    countries: list[NameCount]
    hours: list[int]
    conversions: Conversions