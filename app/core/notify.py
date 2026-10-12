"""Outbound notifications: email (Resend), WhatsApp (Meta Cloud API), newsletter list sync.

Everything here is OPTIONAL and driven by env vars (see core/config.py). Until the
keys exist, every helper is a safe no-op that logs why it skipped — the contact form
and newsletter signup still save to the database, so no lead is ever lost.

Uses only the standard library (urllib) so no new dependency is needed.
"""
from __future__ import annotations

import html
import json
import logging
import re
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

from core import config

logger = logging.getLogger("notify")

RESEND_BASE = "https://api.resend.com"
USER_AGENT = "blueworld-api/1.0"  # some CDNs reject urllib's default User-Agent


class NotifyError(Exception):
    """A provider call failed."""


class NotConfigured(NotifyError):
    """The provider's env vars aren't set yet."""


# --------------------------------------------------------------------------- #
# low-level HTTP
# --------------------------------------------------------------------------- #
def _post_json(url: str, payload: dict, headers: dict, timeout: int = 10) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT, **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        raise NotifyError(f"{e.code} from {url}: {body}") from e
    except urllib.error.URLError as e:
        raise NotifyError(f"Could not reach {url}: {e.reason}") from e
    except TimeoutError as e:
        raise NotifyError(f"Timed out calling {url}") from e


def _one_line(value: str, limit: int) -> str:
    """WhatsApp template variables can't contain newlines/tabs/long runs of spaces."""
    text = re.sub(r"\s+", " ", value or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _html_text(value: str) -> str:
    return html.escape(value or "").replace("\n", "<br>")


# --------------------------------------------------------------------------- #
# email (Resend)
# --------------------------------------------------------------------------- #
def email_configured() -> bool:
    return bool(config.RESEND_API_KEY and config.MAIL_FROM)


def send_email(
    *,
    to: list[str],
    subject: str,
    text: str,
    html_body: str | None = None,
    reply_to: str | None = None,
) -> dict:
    if not email_configured():
        raise NotConfigured(
            "Email sending isn't configured yet — set RESEND_API_KEY and MAIL_FROM on the server."
        )
    payload: dict = {
        "from": config.MAIL_FROM,
        "to": to,
        "subject": _one_line(subject, 200),
        "text": text,
    }
    if html_body:
        payload["html"] = html_body
    if reply_to:
        payload["reply_to"] = reply_to
    return _post_json(f"{RESEND_BASE}/emails", payload, {"Authorization": f"Bearer {config.RESEND_API_KEY}"})


def _wrap_html(inner: str) -> str:
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#10264d;'
        f'max-width:620px">{inner}</div>'
    )


def build_reply_email(*, body: str, original_name: str, original_message: str, original_at: datetime) -> tuple[str, str]:
    """Returns (text, html) for a CMS reply, with the customer's original message quoted underneath."""
    when = original_at.astimezone(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    quoted_text = "\n".join("> " + line for line in original_message.splitlines())
    text = f"{body}\n\n--\nOn {when}, {original_name} wrote:\n{quoted_text}\n"
    html_out = _wrap_html(
        f"<p>{_html_text(body)}</p>"
        '<hr style="border:none;border-top:1px solid #d9dee8;margin:24px 0">'
        f'<p style="color:#6b7690;font-size:13px">On {html.escape(when)}, {html.escape(original_name)} wrote:</p>'
        '<blockquote style="margin:0;padding-left:14px;border-left:3px solid #e77c1a;color:#44506b">'
        f"{_html_text(original_message)}</blockquote>"
    )
    return text, html_out


# --------------------------------------------------------------------------- #
# WhatsApp Business Cloud API
# --------------------------------------------------------------------------- #
def whatsapp_configured() -> bool:
    return bool(config.WHATSAPP_TOKEN and config.WHATSAPP_PHONE_NUMBER_ID and config.WHATSAPP_NOTIFY_TO)


def send_whatsapp_template(to: str, params: list[str]) -> dict:
    """Sends the approved template (body variables {{1}}..{{n}} = params) to one number."""
    if not whatsapp_configured():
        raise NotConfigured("WhatsApp isn't configured yet.")
    url = f"https://graph.facebook.com/{config.WHATSAPP_API_VERSION}/{config.WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": config.WHATSAPP_TEMPLATE_NAME,
            "language": {"code": config.WHATSAPP_TEMPLATE_LANG},
            "components": [
                {"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}
            ],
        },
    }
    return _post_json(url, payload, {"Authorization": f"Bearer {config.WHATSAPP_TOKEN}"})


# --------------------------------------------------------------------------- #
# background jobs (each opens its own DB session — the request's is already closed)
# --------------------------------------------------------------------------- #
def notify_new_contact(submission_id: uuid.UUID) -> None:
    """Email + WhatsApp alert for a new contact message. Never raises."""
    from db.session import SessionLocal
    from models.submission import ContactSubmission

    db = SessionLocal()
    try:
        row = db.get(ContactSubmission, submission_id)
        if row is None:
            return

        # ---- email to the sales inbox(es) ----
        if email_configured() and config.SALES_NOTIFY_EMAILS:
            try:
                phone_line = f"Phone: {row.phone}\n" if row.phone else ""
                text = (
                    f"New website enquiry ({row.enquiry_type})\n\n"
                    f"From: {row.full_name} <{row.email}>\n{phone_line}"
                    f"Subject: {row.subject}\n\n{row.message}\n\n"
                    "Reply to this email to answer them directly, or open the CMS inbox."
                )
                phone_html = f"<tr><td><b>Phone</b></td><td>{html.escape(row.phone)}</td></tr>" if row.phone else ""
                html_body = _wrap_html(
                    f'<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#e77c1a;'
                    f'font-weight:bold;margin:0 0 8px">New website enquiry · {html.escape(row.enquiry_type)}</p>'
                    f'<h2 style="margin:0 0 16px">{html.escape(row.subject or "")}</h2>'
                    '<table cellpadding="4" style="font-size:14px;margin-bottom:16px">'
                    f"<tr><td><b>From</b></td><td>{html.escape(row.full_name)}</td></tr>"
                    f'<tr><td><b>Email</b></td><td><a href="mailto:{html.escape(row.email)}">{html.escape(row.email)}</a></td></tr>'
                    f"{phone_html}</table>"
                    f'<div style="background:#f3f5fa;border-left:3px solid #e77c1a;padding:14px 16px">{_html_text(row.message)}</div>'
                    '<p style="color:#6b7690;font-size:13px">Hit reply to answer them directly.</p>'
                )
                send_email(
                    to=config.SALES_NOTIFY_EMAILS,
                    subject=f"[Website · {row.enquiry_type}] {row.subject} — {row.full_name}",
                    text=text,
                    html_body=html_body,
                    reply_to=row.email,
                )
            except Exception:
                logger.exception("Contact alert email failed for submission %s", submission_id)
        else:
            logger.info("Contact alert email skipped (set RESEND_API_KEY, MAIL_FROM, SALES_NOTIFY_EMAILS).")

        # ---- WhatsApp alert ----
        if whatsapp_configured():
            params = [
                _one_line(row.full_name, 60),
                _one_line(row.enquiry_type, 30),
                _one_line(row.subject or "-", 80),
                _one_line(row.message, 200),
            ]
            for number in config.WHATSAPP_NOTIFY_TO:
                try:
                    send_whatsapp_template(number, params)
                except Exception:
                    logger.exception("WhatsApp alert to %s failed for submission %s", number, submission_id)
        else:
            logger.info("WhatsApp alert skipped (WHATSAPP_* env vars not set).")
    except Exception:
        logger.exception("notify_new_contact crashed for %s", submission_id)
    finally:
        db.close()


def _resend_add_contact(email: str) -> None:
    if not config.RESEND_API_KEY:
        raise NotConfigured("RESEND_API_KEY is not set.")
    payload: dict = {"email": email, "unsubscribed": False}
    if config.RESEND_SEGMENT_ID:
        payload["segments"] = [config.RESEND_SEGMENT_ID]
    if config.RESEND_AUDIENCE_ID:
        payload["audience_id"] = config.RESEND_AUDIENCE_ID
    _post_json(f"{RESEND_BASE}/contacts", payload, {"Authorization": f"Bearer {config.RESEND_API_KEY}"})


def sync_pending_signups(db, limit: int = 50) -> dict:
    """Pushes signups that haven't reached Resend yet. Returns counts for the admin UI."""
    from models.submission import NewsletterSignup

    if not config.RESEND_API_KEY:
        raise NotConfigured("Newsletter sync isn't configured yet — set RESEND_API_KEY on the server.")
    pending = (
        db.query(NewsletterSignup)
        .filter(NewsletterSignup.synced_at.is_(None))
        .order_by(NewsletterSignup.created_at)
        .limit(limit)
        .all()
    )
    synced = failed = 0
    for i, row in enumerate(pending):
        if i:
            time.sleep(0.6)  # stay under Resend's default 2 requests/second
        try:
            _resend_add_contact(row.email)
            row.synced_at = datetime.now(timezone.utc)
            db.commit()
            synced += 1
        except Exception:
            db.rollback()
            logger.exception("Resend contact sync failed for %s", row.email)
            failed += 1
    remaining = db.query(NewsletterSignup).filter(NewsletterSignup.synced_at.is_(None)).count()
    return {"synced": synced, "failed": failed, "remaining": remaining}


def sync_newsletter_signup(signup_id: uuid.UUID) -> None:
    """Background: push one new subscriber to Resend. Never raises."""
    from db.session import SessionLocal
    from models.submission import NewsletterSignup

    if not config.RESEND_API_KEY:
        logger.info("Newsletter sync skipped (RESEND_API_KEY not set).")
        return
    db = SessionLocal()
    try:
        row = db.get(NewsletterSignup, signup_id)
        if row is None or row.synced_at is not None:
            return
        _resend_add_contact(row.email)
        row.synced_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Newsletter sync failed for signup %s", signup_id)
    finally:
        db.close()