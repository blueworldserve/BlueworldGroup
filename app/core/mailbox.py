"""Reads the company mailboxes over IMAP and files what arrives into the CMS.

Every mailbox in config.IMAP_ACCOUNTS (e.g. sales@blueworldcosmetics.ng and a Gmail test inbox) is checked on its own,
so one wrong password never blocks the others. Each new email is routed like this:

  1. from an applicant who was approved / declined  -> a reply on the CMS "Responses" page
  2. from someone who used the contact form before   -> added to that person's thread in the CMS Inbox (marked unread)
  3. from a stranger who emailed a COMPANY address    -> a NEW thread in the CMS Inbox (only if IMAP_IMPORT_UNKNOWN=true)
  Anything else (verification codes, receipts, newsletters sent to the mailbox itself) is ignored.

Staff then answer from the Inbox, choosing which address to send from. The mailbox is only ever READ
(BODY.PEEK, read-only select): nothing is marked as read, moved or deleted.
"""
from __future__ import annotations

import email
import html as html_lib
import imaplib
import logging
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.utils import getaddresses, parseaddr, parsedate_to_datetime

from sqlalchemy.exc import IntegrityError

from core import config
from core.notify import NotConfigured, NotifyError

logger = logging.getLogger("mailbox")

# Per-mailbox health, shown in the CMS and used to back off after failures.
_state: dict[str, dict] = {}
_state_lock = threading.Lock()
_AUTH_BACKOFF_SECONDS = 30 * 60  # a wrong password is not fixed by retrying every 3 minutes (and Google may lock the account)


def configured() -> bool:
    return bool(config.IMAP_ACCOUNTS)


def reply_inbox(sender: str | None = None) -> str | None:
    """Where replies to a letter should go: the address the letter is sent from, so the answer lands in that company
    mailbox (and the CMS reads it when that address is one of the configured IMAP mailboxes). With no sender given,
    the first configured mailbox."""
    if sender:
        return sender
    return config.IMAP_ACCOUNTS[0]["user"] if config.IMAP_ACCOUNTS else None


def mailbox_addresses() -> set[str]:
    return {a["user"].lower() for a in config.IMAP_ACCOUNTS}


def status() -> list[dict]:
    """One row per mailbox for the CMS: is the last check OK, and if not, why."""
    out = []
    with _state_lock:
        for acct in config.IMAP_ACCOUNTS:
            st = _state.get(acct["user"], {})
            out.append(
                {
                    "address": acct["user"],
                    "ok": st.get("error") is None,
                    "last_error": st.get("error"),
                    "last_checked_at": st.get("checked_at"),
                }
            )
    return out


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


_NO_REPLY = re.compile(r"(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer-daemon|postmaster|bounces?)", re.I)


def _is_automatic(sender: str, header) -> bool:
    """Bounces, newsletters and our own system mail must not become inbox threads."""
    if not sender or _NO_REPLY.search(sender.split("@")[0]):
        return True
    auto = (header.get("Auto-Submitted") or "").strip().lower()
    if auto and auto != "no":
        return True
    return (header.get("Precedence") or "").strip().lower() in {"bulk", "junk", "list"}


def _system_sender() -> set[str]:
    """The address our own system mail (contact alerts) is sent from. Those copies landing in a mailbox are not customers."""
    from email.utils import parseaddr as _parse

    addr = _parse(config.MAIL_FROM or "")[1].strip().lower()
    return {addr} if addr else set()


def _friendly_error(acct: dict, err: Exception) -> str:
    text = str(err)
    if isinstance(err, imaplib.IMAP4.error) and re.search(r"AUTHENTICATIONFAILED|invalid credentials|authentication failed|login failed", text, re.I):
        if "gmail" in acct["host"].lower():
            return (
                f"Google rejected the login for {acct['user']}. Create a NEW app password while signed in to exactly this Google "
                "account (2-Step Verification must be on), paste it into the server variable, and restart. Changing the Google "
                "password revokes old app passwords. If this address is NOT a Gmail / Google Workspace mailbox, set IMAP_HOST for it."
            )
        return (
            f"{acct['host']} rejected the login for {acct['user']}. Use the FULL email address as the username and that mailbox's own "
            "password, and check that IMAP_HOST is your mail provider's IMAP server."
        )
    if isinstance(err, OSError):
        return f"Could not connect to {acct['host']}:{acct['port']} ({err}). Check IMAP_HOST (and IMAP_PORT)."
    return f"{acct['user']}: {text}"


def _is_auth_error(err: Exception) -> bool:
    return isinstance(err, imaplib.IMAP4.error) and bool(
        re.search(r"AUTHENTICATIONFAILED|invalid credentials|authentication failed|login failed", str(err), re.I)
    )


def _context(db) -> dict:
    """What we already know, loaded once per check."""
    from models.submission import ApplicationResponse, CareerApplication, ContactReply, ContactSubmission

    decided = (
        db.query(CareerApplication)
        .filter(CareerApplication.status != "new")
        .order_by(CareerApplication.decided_at.asc())
        .all()
    )
    contacts = db.query(ContactSubmission.id, ContactSubmission.email).order_by(ContactSubmission.created_at.asc()).all()
    known = {r[0] for r in db.query(ApplicationResponse.message_id).all()}
    known |= {r[0] for r in db.query(ContactSubmission.message_id).filter(ContactSubmission.message_id.isnot(None)).all()}
    known |= {r[0] for r in db.query(ContactReply.message_id).filter(ContactReply.message_id.isnot(None)).all()}
    return {
        "applicants": {a.email.strip().lower(): a for a in decided},  # latest decision wins per address
        "contacts": {(c.email or "").strip().lower(): c.id for c in contacts},  # latest thread wins per address
        "known": known,
        "own": _system_sender(),
        "company": set(config.COMPANY_ADDRESSES),
    }


def _file_message(db, ctx: dict, acct: dict, *, sender: str, sender_name: str, message_id: str, msg, received: datetime, recipients: set[str] | None = None) -> str | None:
    """Stores one email. Returns "applicant" / "reply" / "new" / None (skipped)."""
    from models.submission import ApplicationResponse, ContactReply, ContactSubmission

    subject = _decode(msg.get("Subject"))[:200]
    raw_body = _body_text(msg)
    body = _strip_quoted(raw_body) or raw_body.strip() or "(no text)"

    application = ctx["applicants"].get(sender)
    if application is not None:
        db.add(
            ApplicationResponse(
                application_id=application.id,
                from_email=sender,
                subject=subject,
                body=body[:10000],
                message_id=message_id[:500],
                received_at=received,
            )
        )
        kind = "applicant"
    elif sender in ctx["contacts"]:
        thread = db.get(ContactSubmission, ctx["contacts"][sender])
        if thread is None:
            return None
        db.add(
            ContactReply(
                submission_id=thread.id,
                to_email=acct["user"],
                subject=subject or (thread.subject or ""),
                body=body[:10000],
                sent_by=None,
                from_email=sender,
                direction="in",
                message_id=message_id[:500],
                sent_at=received,
            )
        )
        thread.status = "new"  # unread again, so it shows up in the CMS
        kind = "reply"
    else:
        if not config.IMAP_IMPORT_UNKNOWN:
            return None
        if not (ctx["company"] & (recipients or set())):
            return None  # sent to a personal inbox, not to a company address (verification codes, receipts, newsletters)
        if received < datetime.now(timezone.utc) - timedelta(days=config.IMAP_NEW_THREAD_DAYS):
            return None  # old mail from a stranger: not worth opening a thread for
        row = ContactSubmission(
            full_name=(sender_name or sender.split("@")[0])[:120],
            email=sender,
            phone=None,
            enquiry_type="Email",
            subject=subject or "(no subject)",
            message=body[:10000],
            status="new",
            source="email",
            mailbox=acct["user"],
            message_id=message_id[:500],
            created_at=received,
        )
        db.add(row)
        db.flush()
        ctx["contacts"][sender] = row.id  # a second email from them in this same check joins the thread
        kind = "new"
    try:
        db.commit()
    except IntegrityError:  # another server stored it first
        db.rollback()
        return None
    ctx["known"].add(message_id)
    return kind


def _poll_account(db, ctx: dict, acct: dict) -> dict:
    since = (datetime.now(timezone.utc) - timedelta(days=config.IMAP_LOOKBACK_DAYS)).strftime("%d-%b-%Y")
    counts = {"new": 0, "checked": 0}
    imap = imaplib.IMAP4_SSL(acct["host"], acct["port"], timeout=30)
    try:
        imap.login(acct["user"], acct["password"])
        imap.select(config.IMAP_FOLDER, readonly=True)  # read-only: nothing gets marked as read
        _, data = imap.search(None, "SINCE", since)
        for num in (data[0].split() if data and data[0] else [])[-300:]:
            _, head = imap.fetch(num, "(BODY.PEEK[HEADER.FIELDS (FROM TO CC DELIVERED-TO X-ORIGINAL-TO MESSAGE-ID AUTO-SUBMITTED PRECEDENCE)])")
            header = email.message_from_bytes(head[0][1]) if head and head[0] else None
            if header is None:
                continue
            name, sender = parseaddr(_decode(header.get("From")))
            sender = sender.strip().lower()
            message_id = (header.get("Message-ID") or "").strip()
            if not message_id or message_id in ctx["known"] or sender in ctx["own"] or sender == acct["user"].lower() or _is_automatic(sender, header):
                continue
            counts["checked"] += 1
            recipients = {
                a.strip().lower()
                for _, a in getaddresses(
                    [_decode(v) for v in [*header.get_all("To", []), *header.get_all("Cc", []), *header.get_all("Delivered-To", []), *header.get_all("X-Original-To", [])]]
                )
                if a
            }
            _, full = imap.fetch(num, "(BODY.PEEK[])")
            msg = email.message_from_bytes(full[0][1])
            try:
                received = parsedate_to_datetime(msg.get("Date")).astimezone(timezone.utc)
            except Exception:
                received = datetime.now(timezone.utc)
            if _file_message(db, ctx, acct, sender=sender, sender_name=name, message_id=message_id, msg=msg, received=received, recipients=recipients):
                counts["new"] += 1
    finally:
        try:
            imap.logout()
        except Exception:
            pass
    return counts


def _record(acct: dict, error: str | None) -> None:
    with _state_lock:
        st = _state.setdefault(acct["user"], {"fails": 0, "retry_at": 0.0})
        st["checked_at"] = datetime.now(timezone.utc)
        st["error"] = error


def poll_replies(db, *, respect_backoff: bool = False) -> dict:
    """Checks every mailbox now. Returns {"new": stored, "checked": looked at}.
    Raises NotifyError (with the reason) only if EVERY mailbox failed, so the CMS "check now" button can show why."""
    if not configured():
        raise NotConfigured("Mailbox reading isn't set up, set IMAP_USER and IMAP_PASSWORD (or SMTP_USER / SMTP_PASSWORD) on the server.")

    ctx = _context(db)
    total = {"new": 0, "checked": 0}
    errors: list[str] = []
    attempted = 0
    for acct in config.IMAP_ACCOUNTS:
        st = _state.setdefault(acct["user"], {"fails": 0, "retry_at": 0.0})
        if respect_backoff and time.time() < st["retry_at"]:
            continue
        attempted += 1
        try:
            counts = _poll_account(db, ctx, acct)
            total["new"] += counts["new"]
            total["checked"] += counts["checked"]
            st["fails"] = 0
            st["retry_at"] = 0.0
            _record(acct, None)
        except (imaplib.IMAP4.error, OSError, UnicodeError) as e:
            db.rollback()
            message = _friendly_error(acct, e)
            st["fails"] = st.get("fails", 0) + 1
            wait = _AUTH_BACKOFF_SECONDS if _is_auth_error(e) else min(900, 60 * 2 ** min(st["fails"], 4))
            st["retry_at"] = time.time() + wait
            _record(acct, message)
            errors.append(message)
            logger.error("Mailbox %s: %s (next automatic try in %d min)", acct["user"], message, wait // 60)
    if errors and len(errors) == attempted:
        raise NotifyError(" | ".join(errors))
    total["errors"] = errors
    return total


def poll_in_background() -> None:
    """Scheduler entry point. Never raises."""
    from db.session import SessionLocal

    db = SessionLocal()
    try:
        poll_replies(db, respect_backoff=True)
    except NotConfigured:
        pass
    except NotifyError:
        pass  # already logged per mailbox, with the reason
    except Exception:
        logger.exception("Mailbox poll failed")
    finally:
        db.close()
