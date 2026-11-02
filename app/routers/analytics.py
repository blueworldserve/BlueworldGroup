"""Visitor analytics.

  POST /analytics/collect          public; the website's tracker sends batches of events here
  GET  /admin/analytics/summary    CMS; every number the Analytics page shows

No IP addresses or personal details are stored (see models/analytics_event.py).
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import ValidationError
from sqlalchemy import and_, case, distinct, exists, extract, func
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from core.deps import get_db
from core.limiter import limiter
from core.permissions import require_read
from db.session import SessionLocal
from models.analytics_event import AnalyticsEvent as E
from models.submission import CareerApplication, ContactSubmission, NewsletterSignup
from schemas.analytics import (
    AnalyticsSummary, ClickRow, CollectIn, Conversions, DayPoint, NameCount, PageRow, Totals, _clean,
)

logger = logging.getLogger("analytics")

public_router = APIRouter(prefix="/analytics", tags=["analytics"])
admin_router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"])

MAX_BODY_BYTES = 32 * 1024
LAGOS_TZ = "Africa/Lagos"
_BOT_WORDS = ("bot", "crawl", "spider", "slurp", "headless", "lighthouse", "preview", "monitor", "uptime", "curl", "python-requests")


async def _read_capped(request: Request, limit: int) -> bytes | None:
    """Reads the body, giving up as soon as it passes `limit` (a lying or chunked upload can't fill memory)."""
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            return None
        chunks.append(chunk)
    return b"".join(chunks)


def _country(request: Request) -> str | None:
    """Only filled when a CDN/proxy in front of the API tells us (Cloudflare, Vercel...). We never look up IPs."""
    raw = request.headers.get("cf-ipcountry") or request.headers.get("x-vercel-ip-country") or ""
    raw = raw.strip().upper()
    return raw if len(raw) == 2 and raw.isalpha() and raw not in ("XX", "T1") else None


def _store(payload: CollectIn, country: str | None) -> None:
    db = SessionLocal()
    try:
        for ev in payload.events:
            if ev.path.startswith("/admin"):
                continue
            db.add(E(
                visitor_id=payload.visitor_id,
                session_id=payload.session_id,
                kind=ev.kind,
                path=ev.path,
                label=_clean(ev.label, 120),
                target=_clean(ev.target, 200),
                section=_clean(ev.section, 60),
                referrer=_clean(ev.referrer, 120),
                device=ev.device,
                country=country,
                duration_s=ev.duration_s,
                scroll_pct=ev.scroll_pct,
            ))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Could not store analytics events")
    finally:
        db.close()


@public_router.post("/collect", status_code=204)
@limiter.limit("120/minute")
async def collect(request: Request):
    """Always answers 204: tracking must never show a visitor an error. The body is JSON sent as text/plain
    (that's what lets navigator.sendBeacon work from another domain without a CORS preflight)."""
    ua = (request.headers.get("user-agent") or "").lower()
    if any(w in ua for w in _BOT_WORDS):
        return Response(status_code=204)
    raw = await _read_capped(request, MAX_BODY_BYTES)
    if raw is None:
        return Response(status_code=204)
    try:
        payload = CollectIn.model_validate(json.loads(raw))
    except (ValueError, ValidationError):
        return Response(status_code=204)
    await run_in_threadpool(_store, payload, _country(request))
    return Response(status_code=204)


# ------------------------------------------------------------------ admin summary
def _lagos(col):
    return func.timezone(LAGOS_TZ, col)


@admin_router.get("/summary", response_model=AnalyticsSummary)
def summary(
    since: datetime | None = Query(None),
    until: datetime | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_read),
):
    now = datetime.now(timezone.utc)
    until = (until or now).astimezone(timezone.utc)
    since = (since or until - timedelta(days=7)).astimezone(timezone.utc)
    if since >= until:
        since = until - timedelta(days=1)
    if until - since > timedelta(days=400):
        since = until - timedelta(days=400)

    in_range = and_(E.created_at >= since, E.created_at < until)

    visitors, sessions, pageviews, clicks = db.query(
        func.count(distinct(E.visitor_id)),
        func.count(distinct(E.session_id)),
        func.count(case((E.kind == "pageview", 1))),
        func.count(case((E.kind == "click", 1))),
    ).filter(in_range).one()

    earlier = E.__table__.alias("earlier")
    returning = (
        db.query(func.count(distinct(E.visitor_id)))
        .filter(in_range, exists().where(and_(earlier.c.visitor_id == E.visitor_id, earlier.c.created_at < since)))
        .scalar()
    ) or 0

    avg_seconds = (
        db.query(func.avg(E.duration_s)).filter(in_range, E.kind == "leave", E.duration_s > 0).scalar()
    ) or 0

    day = func.date(_lagos(E.created_at))
    per_day = {
        str(d): (v, p)
        for d, v, p in db.query(day, func.count(distinct(E.visitor_id)), func.count(case((E.kind == "pageview", 1))))
        .filter(in_range).group_by(day).all()
    }
    daily: list[DayPoint] = []
    cursor = (since + timedelta(hours=1)).date()  # Lagos is UTC+1 all year
    last = (until + timedelta(hours=1)).date()
    while cursor <= last:
        v, p = per_day.get(cursor.isoformat(), (0, 0))
        daily.append(DayPoint(date=cursor.isoformat(), visitors=v, pageviews=p))
        cursor += timedelta(days=1)

    views = (
        db.query(E.path, func.count(E.id), func.count(distinct(E.visitor_id)))
        .filter(in_range, E.kind == "pageview")
        .group_by(E.path).order_by(func.count(E.id).desc()).limit(15).all()
    )
    engagement = {
        path: (int(avg_d or 0), int(avg_s or 0))
        for path, avg_d, avg_s in db.query(E.path, func.avg(E.duration_s), func.avg(E.scroll_pct))
        .filter(in_range, E.kind == "leave", E.duration_s > 0).group_by(E.path).all()
    }
    top_pages = [
        PageRow(path=p, views=n, visitors=u, avg_seconds=engagement.get(p, (0, 0))[0], avg_scroll=engagement.get(p, (0, 0))[1])
        for p, n, u in views
    ]

    top_clicks = [
        ClickRow(label=l, target=t, section=s, clicks=n, visitors=u)
        for l, t, s, n, u in db.query(
            E.label, E.target, E.section, func.count(E.id), func.count(distinct(E.visitor_id))
        )
        .filter(in_range, E.kind == "click", E.label.isnot(None))
        .group_by(E.label, E.target, E.section).order_by(func.count(E.id).desc()).limit(20).all()
    ]

    first = func.split_part(E.path, "/", 2)
    sections = [
        NameCount(name=name or "home", count=n)
        for name, n in db.query(first, func.count(E.id))
        .filter(in_range, E.kind == "pageview").group_by(first).order_by(func.count(E.id).desc()).limit(10).all()
    ]

    referrers = [
        NameCount(name=r, count=n)
        for r, n in db.query(E.referrer, func.count(distinct(E.session_id)))
        .filter(in_range, E.kind == "pageview", E.referrer.isnot(None))
        .group_by(E.referrer).order_by(func.count(distinct(E.session_id)).desc()).limit(8).all()
    ]
    devices = [
        NameCount(name=d, count=n)
        for d, n in db.query(E.device, func.count(distinct(E.visitor_id)))
        .filter(in_range, E.device.isnot(None)).group_by(E.device).order_by(func.count(distinct(E.visitor_id)).desc()).all()
    ]
    countries = [
        NameCount(name=c, count=n)
        for c, n in db.query(E.country, func.count(distinct(E.visitor_id)))
        .filter(in_range, E.country.isnot(None)).group_by(E.country).order_by(func.count(distinct(E.visitor_id)).desc()).limit(10).all()
    ]

    hour = extract("hour", _lagos(E.created_at))
    hours = [0] * 24
    for h, n in db.query(hour, func.count(E.id)).filter(in_range, E.kind == "pageview").group_by(hour).all():
        hours[int(h)] = n

    def count_between(model) -> int:
        return db.query(func.count(model.id)).filter(model.created_at >= since, model.created_at < until).scalar() or 0

    return AnalyticsSummary(
        since=since.isoformat(),
        until=until.isoformat(),
        totals=Totals(
            visitors=visitors,
            returning_visitors=returning,
            sessions=sessions,
            pageviews=pageviews,
            clicks=clicks,
            avg_seconds_on_page=int(avg_seconds),
            pages_per_session=round(pageviews / sessions, 1) if sessions else 0,
        ),
        daily=daily,
        top_pages=top_pages,
        top_clicks=top_clicks,
        sections=sections,
        referrers=referrers,
        devices=devices,
        countries=countries,
        hours=hours,
        conversions=Conversions(
            contact_messages=count_between(ContactSubmission),
            newsletter_signups=count_between(NewsletterSignup),
            job_applications=count_between(CareerApplication),
        ),
    )