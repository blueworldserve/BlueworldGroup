"""Collects applicants' replies to approval / decline letters from the HR mailbox (IMAP).

Applicant emails use that mailbox as their Reply-To, so a reply lands there. This module reads recent
mail, keeps only messages sent by someone who has been approved or declined, and stores them as
ApplicationResponse rows for the CMS "Responses" page. It never changes, moves or deletes anything in the mailbox.
"""
from __future__ import annotations

import email
import html as html_lib
import imaplib
import logging
import re
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.utils import parseaddr, parsedate_to_datetime

from sqlalchemy.exc import IntegrityError

from core import config
from core.notify import NotConfigured, NotifyError

logger = logging.getLogger("mailbox")


def configured() -> bool:
    return bool(config.IMAP_HOST and config.IMAP_USER and config.IMAP_PASSWORD)


def reply_inbox() -> str | None:
    """The address applicants should reply to, so their answer reaches the CMS (None if not set up)."""
    return config.IMAP_USER if configured() else None


def _decode(value: str | None) -> str:
    try:
        return str(make_header(decode_header(value or "")))
    except Exception:
        return value or ""


def _body_text(msg: email.message.Message) -> str:
    plain, html_part = "", ""
    for part in msg.walk():
        if part.get_content_maintype() != "text" or part.get_filename():
            continue
        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        if part.get_content_subtype() == "plain" and not plain:
            plain = text
        elif part.get_content_subtype() == "html" and not html_part:
            html_part = text
    if plain.strip():
        return plain
    text = re.sub(r"(?is)<(script|style).*?</\1>", "", html_part)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>", "\n", text)
    return html_lib.unescape(re.sub(r"<[^>]+>", "", text))


def _strip_quoted(text: str) -> str:
    """Keeps what the applicant wrote and drops the quoted copy of our letter underneath."""
    text = text.replace("\r\n", "\n")
    text = re.split(r"\n\s*On .{0,250}?wrote:\s*\n", "\n" + text, maxsplit=1, flags=re.S)[0]
    text = re.split(r"\n-{2,}\s*Original Message|\n_{5,}|\nFrom:\s.+\nSent:", text, maxsplit=1, flags=re.I)[0]
    lines = [ln for ln in text.split("\n") if not ln.lstrip().startswith(">")]
    return "\n".join(lines).strip()


def poll_replies(db) -> dict:
    """Reads the last 14 days of the mailbox. Returns {"new": stored, "checked": looked at}."""
    from models.submission import ApplicationResponse, CareerApplication

    if not configured():
        raise NotConfigured("Reply collection isn't set up — set IMAP_USER and IMAP_PASSWORD on the server.")

    decided = (
        db.query(CareerApplication)
        .filter(CareerApplication.status != "new")
        .order_by(CareerApplication.decided_at.asc())
        .all()
    )
    by_email = {a.email.strip().lower(): a for a in decided}  # latest decision wins per address
    if not by_email:
        return {"new": 0, "checked": 0}

    known = {r[0] for r in db.query(ApplicationResponse.message_id).all()}
    since = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%d-%b-%Y")
    stored = checked = 0
    try:
        imap = imaplib.IMAP4_SSL(config.IMAP_HOST, timeout=30)
        try:
            imap.login(config.IMAP_USER, config.IMAP_PASSWORD)
            imap.select(config.IMAP_FOLDER, readonly=True)  # read-only: nothing gets marked as read
            _, data = imap.search(None, "SINCE", since)
            for num in (data[0].split() if data and data[0] else [])[-300:]:
                _, head = imap.fetch(num, "(BODY.PEEK[HEADER.FIELDS (FROM MESSAGE-ID)])")
                header = email.message_from_bytes(head[0][1]) if head and head[0] else None
                if header is None:
                    continue
                sender = parseaddr(_decode(header.get("From")))[1].lower()
                message_id = (header.get("Message-ID") or "").strip()
                application = by_email.get(sender)
                if application is None or not message_id or message_id in known:
                    continue
                checked += 1
                _, full = imap.fetch(num, "(BODY.PEEK[])")
                msg = email.message_from_bytes(full[0][1])
                body = _strip_quoted(_body_text(msg)) or "(no text)"
                try:
                    received = parsedate_to_datetime(msg.get("Date")).astimezone(timezone.utc)
                except Exception:
                    received = datetime.now(timezone.utc)
                db.add(
                    ApplicationResponse(
                        application_id=application.id,
                        from_email=sender,
                        subject=_decode(msg.get("Subject"))[:200],
                        body=body[:10000],
                        message_id=message_id[:500],
                        received_at=received,
                    )
                )
                try:
                    db.commit()
                    known.add(message_id)
                    stored += 1
                except IntegrityError:  # another server stored it first
                    db.rollback()
        finally:
            try:
                imap.logout()
            except Exception:
                pass
    except (imaplib.IMAP4.error, OSError) as e:
        raise NotifyError(f"Could not read the mailbox: {e}") from e
    return {"new": stored, "checked": checked}


def poll_in_background() -> None:
    """Scheduler entry point. Never raises."""
    from db.session import SessionLocal

    db = SessionLocal()
    try:
        poll_replies(db)
    except NotConfigured:
        pass
    except Exception:
        logger.exception("Mailbox poll failed")
    finally:
        db.close()
