"""Outbound notifications: email (Resend), job-application alerts, newsletter list sync.

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
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from datetime import datetime, timedelta, timezone

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
    """Collapses whitespace to a single line (email subjects can't contain newlines)."""
    text = re.sub(r"\s+", " ", value or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _html_text(value: str) -> str:
    return html.escape(value or "").replace("\n", "<br>")


# --------------------------------------------------------------------------- #
# email (Resend)
# --------------------------------------------------------------------------- #
def email_configured() -> bool:
    return bool(config.RESEND_API_KEY and config.MAIL_FROM)


_EMAIL_RE = re.compile(r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")
# Free mailbox providers can't be verified in Resend, so they can only send through SMTP.
FREE_MAIL_DOMAINS = {"gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com"}


def normalize_sender(value: str | None) -> str | None:
    """'' / None -> None (use the default). Otherwise the bare address, or ValueError if it isn't one."""
    if not value or not value.strip():
        return None
    addr = parseaddr(value.strip())[1].strip()
    if not _EMAIL_RE.match(addr) or len(addr) > 254:
        raise ValueError(f"'{value.strip()}' isn't a valid email address.")
    return addr


def smtp_configured() -> bool:
    return bool(config.SMTP_HOST and config.SMTP_USER and config.SMTP_PASSWORD)


def available_senders() -> tuple[list[str], str | None]:
    """Addresses to suggest in the CMS, and the default one (what MAIL_FROM sends as)."""
    default = parseaddr(config.MAIL_FROM or "")[1] or None
    seen: list[str] = []
    for a in [default, config.SMTP_USER, *(m["user"] for m in config.IMAP_ACCOUNTS), *config.MAIL_SENDERS]:
        a = (a or "").strip()
        if a and a.lower() not in [x.lower() for x in seen]:
            seen.append(a)
    return seen, default


def _send_smtp(*, addr: str, to: list[str], subject: str, text: str, html_body: str | None, reply_to: str | None) -> dict:
    msg = EmailMessage()
    msg["From"] = formataddr((config.MAIL_FROM_NAME, addr))
    msg["To"] = ", ".join(to)
    msg["Subject"] = _one_line(subject, 200)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
    try:
        if config.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=20, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20)
            server.starttls(context=ssl.create_default_context())
        with server:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as e:
        raise NotifyError(f"SMTP send from {addr} failed: {e}") from e
    return {"provider": "smtp"}


def send_email(
    *,
    to: list[str],
    subject: str,
    text: str,
    html_body: str | None = None,
    reply_to: str | None = None,
    from_email: str | None = None,
) -> dict:
    """Sends one email. `from_email` picks the sender (any address); None = the default MAIL_FROM.
    The sender goes out through SMTP when it is the SMTP_USER mailbox, otherwise through Resend."""
    addr = normalize_sender(from_email)
    if addr and smtp_configured() and addr.lower() == config.SMTP_USER.lower():
        return _send_smtp(addr=addr, to=to, subject=subject, text=text, html_body=html_body, reply_to=reply_to)
    if addr and addr.rsplit("@", 1)[-1].lower() in FREE_MAIL_DOMAINS:
        raise NotConfigured(
            f"{addr} can't send through Resend. To send from it, set SMTP_HOST, SMTP_USER={addr} and "
            "SMTP_PASSWORD (an app password) on the server, or pick an address on your own domain."
        )
    if not (config.RESEND_API_KEY and (addr or config.MAIL_FROM)):
        raise NotConfigured(
            "Email sending isn't configured yet — set RESEND_API_KEY and MAIL_FROM on the server."
        )
    payload: dict = {
        "from": formataddr((config.MAIL_FROM_NAME, addr)) if addr else config.MAIL_FROM,
        "to": to,
        "subject": _one_line(subject, 200),
        "text": text,
    }
    if html_body:
        payload["html"] = html_body
    if reply_to:
        payload["reply_to"] = reply_to
    return _post_json(f"{RESEND_BASE}/emails", payload, {"Authorization": f"Bearer {config.RESEND_API_KEY}"})

# --------------------------------------------------------------------------- #
# branded email layout (table-based + inline CSS so Gmail / Outlook / phones render it)
# --------------------------------------------------------------------------- #
NAVY = "#10264d"
ORANGE = "#e77c1a"
INK = "#2b3650"
MUTED = "#6b7690"
PAPER = "#f3f5fa"
LINE = "#dfe4ee"
FONT = "Arial,Helvetica,sans-serif"


def _paragraphs(text: str) -> str:
    """Plain text -> paragraphs (blank line = new paragraph, single newline = line break)."""
    blocks = [b.strip() for b in re.split(r"\n\s*\n", (text or "").strip()) if b.strip()]
    return "".join(
        f'<p style="margin:0 0 16px;font-family:{FONT};font-size:15px;line-height:1.7;color:{INK}">{_html_text(b)}</p>'
        for b in blocks
    )


def _button(label: str, href: str) -> str:
    return (
        f'<a href="{html.escape(href)}" style="display:inline-block;background:{ORANGE};color:#ffffff;'
        f"font-family:{FONT};font-size:14px;font-weight:bold;text-decoration:none;padding:14px 30px;"
        f'border-radius:999px">{html.escape(label)}</a>'
    )


def _brand_email(*, preheader: str, eyebrow: str, title: str, inner: str, cta: tuple[str, str] | None = None, note: str = "") -> str:
    """The shared Blue World email shell: logo header, brand bar, content card, navy footer."""
    logo = ""
    if config.MAIL_LOGO_URL:
        logo = (
            f'<td width="66" valign="middle" style="padding-right:14px">'
            f'<img src="{html.escape(config.MAIL_LOGO_URL)}" width="52" height="52" alt="Blue World Cosmetics" '
            'style="display:block;border:0;outline:none;border-radius:8px"></td>'
        )
    header = (
        '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        f"{logo}"
        '<td valign="middle">'
        f'<div style="font-family:{FONT};font-size:19px;font-weight:800;letter-spacing:.01em;color:{NAVY};line-height:1">BLUE WORLD</div>'
        f'<div style="font-family:{FONT};font-size:10px;font-weight:bold;letter-spacing:.34em;color:{ORANGE};margin-top:6px;line-height:1">COSMETICS</div>'
        "</td></tr></table>"
    )
    cta_row = ""
    if cta:
        cta_row = f'<tr><td style="padding:8px 40px 36px 40px">{_button(*cta)}</td></tr>'
    else:
        cta_row = '<tr><td style="height:20px;font-size:0;line-height:0">&nbsp;</td></tr>'
    site = ""
    if config.SITE_URL:
        site = (
            f'<a href="{html.escape(config.SITE_URL)}" style="color:#ffffff;text-decoration:underline">'
            f"{html.escape(config.SITE_URL.replace('https://', '').replace('http://', ''))}</a>"
        )
    note_html = (
        f'<div style="font-family:{FONT};font-size:12px;line-height:1.6;color:#aab6d0;margin-top:10px">{html.escape(note)}</div>'
        if note
        else ""
    )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title></head>
<body style="margin:0;padding:0;background:#e9edf5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">{html.escape(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf5"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="padding:26px 40px 22px 40px">{header}</td></tr>
<tr><td style="height:5px;font-size:0;line-height:0;background:{NAVY};background-image:linear-gradient(90deg,{NAVY},{ORANGE})">&nbsp;</td></tr>
<tr><td style="padding:38px 40px 6px 40px">
<div style="font-family:{FONT};font-size:11px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;color:{ORANGE};margin:0 0 10px">{html.escape(eyebrow)}</div>
<h1 style="margin:0 0 22px;font-family:{FONT};font-size:26px;line-height:1.25;font-weight:800;color:{NAVY}">{html.escape(title)}</h1>
{inner}
</td></tr>
{cta_row}
<tr><td style="background:{NAVY};padding:26px 40px">
<div style="font-family:{FONT};font-size:14px;font-weight:bold;color:#ffffff">Blue World Cosmetics</div>
<div style="font-family:{FONT};font-size:12px;line-height:1.6;color:#aab6d0;margin-top:4px">{site}</div>
{note_html}
</td></tr>
</table>
<div style="font-family:{FONT};font-size:11px;color:{MUTED};margin-top:16px">&copy; {datetime.now(timezone.utc).year} Blue World Cosmetics. All rights reserved.</div>
</td></tr></table>
</body></html>"""


def _detail_card(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        f'<tr><td style="padding:6px 0;font-family:{FONT};font-size:11px;font-weight:bold;letter-spacing:.14em;'
        f'text-transform:uppercase;color:{MUTED};width:110px;vertical-align:top">{html.escape(label)}</td>'
        f'<td style="padding:6px 0;font-family:{FONT};font-size:15px;font-weight:bold;color:{NAVY}">{html.escape(value)}</td></tr>'
        for label, value in rows
    )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAPER};'
        f'border-left:4px solid {ORANGE};border-radius:10px;margin:4px 0 22px"><tr><td style="padding:14px 20px">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" width="100%">{cells}</table></td></tr></table>'
    )


def build_reply_email(*, body: str, original_name: str, original_message: str, original_at: datetime) -> tuple[str, str]:
    """Returns (text, html) for a CMS reply, with the customer's original message quoted underneath."""
    when = original_at.astimezone(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    quoted_text = "\n".join("> " + line for line in original_message.splitlines())
    text = f"{body}\n\n--\nOn {when}, {original_name} wrote:\n{quoted_text}\n"
    inner = (
        _paragraphs(body)
        + f'<div style="border-top:1px solid {LINE};margin:26px 0 16px"></div>'
        f'<p style="margin:0 0 10px;font-family:{FONT};font-size:13px;color:{MUTED}">On {html.escape(when)}, {html.escape(original_name)} wrote:</p>'
        f'<div style="border-left:3px solid {ORANGE};padding:4px 0 4px 16px;font-family:{FONT};font-size:14px;line-height:1.6;color:#44506b">'
        f"{_html_text(original_message)}</div>"
    )
    html_out = _brand_email(
        preheader=_one_line(body, 110),
        eyebrow="A reply from our team",
        title="Thank you for contacting us",
        inner=inner,
        note="You received this email because you contacted Blue World Cosmetics through our website.",
    )
    return text, html_out


def _long_date(d) -> str:
    return f"{d:%A}, {d.day} {d:%B %Y}"


def build_applicant_email(
    *,
    body: str,
    decision: str = "decline",
    role_title: str | None = None,
    interview_date=None,
    interview_time: str | None = None,
) -> tuple[str, str]:
    """Returns (text, html) for HR's decision email. The plain-text part is HR's words exactly as written;
    the HTML part dresses the same words in the Blue World layout (plus an at-a-glance interview card)."""
    approving = decision == "approve"
    inner = ""
    if approving and interview_date is not None:
        rows = []
        if role_title:
            rows.append(("Position", role_title))
        rows.append(("Date", _long_date(interview_date)))
        if interview_time:
            rows.append(("Time", interview_time))
        inner += _detail_card(rows)
    elif role_title:
        inner += (
            f'<p style="margin:-8px 0 20px;font-family:{FONT};font-size:13px;color:{MUTED}">'
            f"Application for <b style=\"color:{NAVY}\">{html.escape(role_title)}</b></p>"
        )
    inner += _paragraphs(body)
    if approving:
        inner += (
            f'<p style="margin:4px 0 0;font-family:{FONT};font-size:13px;line-height:1.6;color:{MUTED}">'
            "Please reply to this email to confirm you can attend, or to ask for another time.</p>"
        )
    html_out = _brand_email(
        preheader=_one_line(body, 110),
        eyebrow="Interview invitation" if approving else "Application update",
        title="You're invited to interview" if approving else "Thank you for applying",
        inner=inner,
        note="You received this email because you applied for a role at Blue World Cosmetics.",
    )
    return body, html_out


def build_application_alert_email(*, kind: str, apps: list[dict]) -> tuple[str, str, str]:
    """Returns (subject, text, html) for the admin/HR alert about waiting job applications.
    kind = "threshold" (enough have piled up) or "digest" (the daily roundup)."""
    from collections import Counter

    n = len(apps)
    plural = "application" if n == 1 else "applications"
    if kind == "threshold":
        subject = f"{n} new job {plural} are waiting for review"
        eyebrow = "Applications milestone"
        title = f"{n} new {plural} are waiting"
        intro = f"New applications have reached {config.APPLICATION_ALERT_THRESHOLD}. Here is everyone who has applied since the last alert."
    else:
        subject = f"Daily applications digest — {n} new {plural}"
        eyebrow = "Daily digest"
        title = f"{n} new {plural} since the last update"
        intro = "Here is your daily roundup of the job applications that came in since the last alert."

    shown = apps[:30]
    by_role = Counter(a["role"] for a in apps)
    chips = "".join(
        f'<span style="display:inline-block;background:{PAPER};border:1px solid {LINE};border-radius:999px;'
        f'padding:5px 12px;margin:0 6px 6px 0;font-family:{FONT};font-size:12px;font-weight:bold;color:{NAVY}">'
        f"{html.escape(role)} · {count}</span>"
        for role, count in by_role.most_common()
    )
    rows = ""
    for a in shown:
        phone = f" · {html.escape(a['phone'])}" if a["phone"] else ""
        cv = ' &nbsp;<span style="color:#1d7a46;font-weight:bold">CV attached</span>' if a["has_resume"] else ""
        when = a["applied"].strftime("%d %b, %H:%M").lstrip("0")
        rows += (
            f'<tr><td style="padding:12px 0;border-top:1px solid {LINE};font-family:{FONT};font-size:14px;color:{NAVY}">'
            f'<b>{html.escape(a["name"])}</b><br>'
            f'<span style="font-size:12px;color:{MUTED}">{html.escape(a["email"])}{phone}{cv}</span></td>'
            f'<td style="padding:12px 0 12px 12px;border-top:1px solid {LINE};font-family:{FONT};font-size:13px;color:{INK};'
            f'vertical-align:top">{html.escape(a["role"])}<br><span style="font-size:12px;color:{MUTED}">{html.escape(when)}</span></td></tr>'
        )
    more = ""
    if n > len(shown):
        more = (
            f'<p style="margin:12px 0 0;font-family:{FONT};font-size:13px;color:{MUTED}">'
            f"…and {n - len(shown)} more. Open the dashboard to see everyone.</p>"
        )
    inner = (
        _paragraphs(intro)
        + f'<div style="margin:0 0 14px">{chips}</div>'
        + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>'
        + more
    )
    cta = ("Review applications", f"{config.SITE_URL}/admin/applications") if config.SITE_URL else None
    html_out = _brand_email(
        preheader=f"{n} {plural} waiting — " + ", ".join(a["name"] for a in apps[:3]),
        eyebrow=eyebrow,
        title=title,
        inner=inner,
        cta=cta,
        note="You are receiving this because you are an admin or HR member of the Blue World CMS.",
    )
    lines = [f"{title}\n", intro, ""]
    for a in shown:
        lines.append(f"- {a['name']} <{a['email']}>{' ' + a['phone'] if a['phone'] else ''} — {a['role']} ({a['applied']:%d %b, %H:%M})")
    if n > len(shown):
        lines.append(f"...and {n - len(shown)} more.")
    if config.SITE_URL:
        lines += ["", f"Review them here: {config.SITE_URL}/admin/applications"]
    return subject, "\n".join(lines) + "\n", html_out
# --------------------------------------------------------------------------- #
# background jobs (each opens its own DB session — the request's is already closed)
# --------------------------------------------------------------------------- #
def notify_new_contact(submission_id: uuid.UUID) -> None:
    """Email alert to the sales inbox(es) for a new contact message. Never raises."""
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
                phone_row = f"<tr><td style=\"padding:4px 14px 4px 0;color:{MUTED}\">Phone</td><td>{html.escape(row.phone)}</td></tr>" if row.phone else ""
                info = (
                    f'<table role="presentation" cellpadding="0" cellspacing="0" style="font-family:{FONT};font-size:14px;color:{NAVY};margin:0 0 18px">'
                    f"<tr><td style=\"padding:4px 14px 4px 0;color:{MUTED}\">From</td><td><b>{html.escape(row.full_name)}</b></td></tr>"
                    f"<tr><td style=\"padding:4px 14px 4px 0;color:{MUTED}\">Email</td><td><a href=\"mailto:{html.escape(row.email)}\" style=\"color:{NAVY}\">{html.escape(row.email)}</a></td></tr>"
                    f"{phone_row}</table>"
                )
                message_box = (
                    f'<div style="background:{PAPER};border-left:4px solid {ORANGE};border-radius:10px;padding:16px 18px;'
                    f'font-family:{FONT};font-size:15px;line-height:1.7;color:{INK}">{_html_text(row.message)}</div>'
                    f'<p style="margin:14px 0 0;font-family:{FONT};font-size:13px;color:{MUTED}">Hit reply to answer them directly.</p>'
                )
                html_body = _brand_email(
                    preheader=_one_line(row.message, 110),
                    eyebrow=f"New website enquiry · {row.enquiry_type}",
                    title=row.subject or "New enquiry",
                    inner=info + message_box,
                    cta=("Open the CMS inbox", f"{config.SITE_URL}/admin/inbox") if config.SITE_URL else None,
                    note="You are receiving this because your address is on the sales notification list.",
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
    except Exception:
        logger.exception("notify_new_contact crashed for %s", submission_id)
    finally:
        db.close()

def _resend_add_contact(email: str) -> None:
    if not config.RESEND_API_KEY:
        raise NotConfigured("RESEND_API_KEY is not set.")
    auth = {"Authorization": f"Bearer {config.RESEND_API_KEY}"}
    try:
        if config.RESEND_AUDIENCE_ID and not config.RESEND_SEGMENT_ID:
            # Older Resend accounts: contacts live inside an audience.
            _post_json(
                f"{RESEND_BASE}/audiences/{config.RESEND_AUDIENCE_ID}/contacts",
                {"email": email, "unsubscribed": False},
                auth,
            )
            return
        payload: dict = {"email": email, "unsubscribed": False}
        if config.RESEND_SEGMENT_ID:
            payload["segments"] = [{"id": config.RESEND_SEGMENT_ID}]  # objects, not bare ids
        _post_json(f"{RESEND_BASE}/contacts", payload, auth)
    except NotifyError as e:
        if "already exist" in str(e).lower():
            return  # already on the list: that's a success for us
        raise


def sync_pending_signups(db, limit: int = 50) -> dict:
    """Pushes signups that haven't reached Resend yet. Returns counts (and the first error) for the admin UI."""
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
    error: str | None = None
    for i, row in enumerate(pending):
        if i:
            time.sleep(0.6)  # stay under Resend's default 2 requests/second
        try:
            _resend_add_contact(row.email)
            row.synced_at = datetime.now(timezone.utc)
            db.commit()
            synced += 1
        except Exception as e:
            db.rollback()
            logger.exception("Resend contact sync failed for %s", row.email)
            failed += 1
            error = error or str(e)
    remaining = db.query(NewsletterSignup).filter(NewsletterSignup.synced_at.is_(None)).count()
    return {"synced": synced, "failed": failed, "remaining": remaining, "error": error}


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







# --------------------------------------------------------------------------- #
# job-application alerts to admins + HR
# --------------------------------------------------------------------------- #
def _staff_recipients(db) -> list[str]:
    """Active admins and HR members (plus the superuser)."""
    from sqlalchemy import or_

    from models.admin_user import AdminRole, AdminStatus, AdminUser

    rows = (
        db.query(AdminUser.email)
        .filter(
            AdminUser.status == AdminStatus.active,
            or_(AdminUser.role.in_([AdminRole.admin, AdminRole.hr]), AdminUser.is_superuser.is_(True)),
        )
        .all()
    )
    return sorted({r[0] for r in rows if r[0]})


def _alert_on_waiting_applications(*, min_count: int, kind: str) -> int:
    """Emails admin + HR about applications nobody has been told about yet, if there are at least `min_count`.

    The waiting applications are claimed (marked `notified_at`) under a row lock BEFORE the email goes out, so two
    servers or two requests at once can never send the same alert twice. If the email then fails, the claim is
    undone so the next check tries again. Returns how many applications were announced."""
    from db.session import SessionLocal
    from models.job_posting import JobPosting
    from models.submission import CareerApplication

    if not email_configured():
        logger.info("Application alert skipped (set RESEND_API_KEY and MAIL_FROM).")
        return 0

    db = SessionLocal()
    try:
        recipients = _staff_recipients(db)
        if not recipients:
            logger.info("Application alert skipped: no active admin or HR users to notify.")
            return 0

        rows = (
            db.query(CareerApplication)
            .filter(CareerApplication.notified_at.is_(None))
            .order_by(CareerApplication.created_at)
            .with_for_update(of=CareerApplication, skip_locked=True)
            .all()
        )
        if len(rows) < min_count or not rows:
            db.rollback()
            return 0

        titles = dict(db.query(JobPosting.slug, JobPosting.title).all())
        lagos = timezone(timedelta(hours=1))
        apps = [
            {
                "name": r.full_name,
                "email": r.email,
                "phone": r.phone or "",
                "role": titles.get(r.job_slug, r.job_slug),
                "applied": r.created_at.astimezone(lagos),
                "has_resume": r.resume is not None,
            }
            for r in rows
        ]
        ids = [r.id for r in rows]
        now = datetime.now(timezone.utc)
        for r in rows:
            r.notified_at = now
        db.commit()

        try:
            subject, text, html_body = build_application_alert_email(kind=kind, apps=apps)
            send_email(to=recipients, subject=subject, text=text, html_body=html_body)
        except Exception:
            logger.exception("Application %s email failed; will retry on the next check", kind)
            db.rollback()
            db.query(CareerApplication).filter(CareerApplication.id.in_(ids)).update(
                {CareerApplication.notified_at: None}, synchronize_session=False
            )
            db.commit()
            return 0
        logger.info("Application %s email sent to %d people for %d applications", kind, len(recipients), len(apps))
        return len(apps)
    except Exception:
        db.rollback()
        logger.exception("Application alert crashed")
        return 0
    finally:
        db.close()


def notify_applications_if_threshold() -> None:
    """Background task after every new application: alerts once enough are waiting. Never raises."""
    try:
        _alert_on_waiting_applications(min_count=config.APPLICATION_ALERT_THRESHOLD, kind="threshold")
    except Exception:
        logger.exception("notify_applications_if_threshold crashed")


def send_application_digest() -> int:
    """The daily roundup: whatever is waiting (even just one), if anything. Never raises."""
    try:
        return _alert_on_waiting_applications(min_count=1, kind="digest")
    except Exception:
        logger.exception("send_application_digest crashed")
        return 0