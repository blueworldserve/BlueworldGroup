import os
from dotenv import load_dotenv

load_dotenv()  # reads app/.env into the process environment — must run before any os.getenv() call

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "90"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",")

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
CLOUDINARY_UPLOAD_FOLDER = os.getenv("CLOUDINARY_UPLOAD_FOLDER", "blueworld")



# --- Rate limiting -----------------------------------------------------------
# How many reverse proxies sit in front of the API (Railway/Render = 1, plus 1 if
# you also put Cloudflare in front). 0 = connect directly, never trust X-Forwarded-For.
TRUSTED_PROXY_COUNT = int(os.getenv("TRUSTED_PROXY_COUNT", "0"))

# --- Email (Resend) — leave unset until the account exists; sending is skipped ---
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
# Official sender, e.g.  Blue World Cosmetics <sales@blueworldcosmetics.org>
# (the domain must be verified in Resend)
MAIL_FROM = os.getenv("MAIL_FROM")
# Where replies from customers should go (defaults to the first notify address)
MAIL_REPLY_TO = os.getenv("MAIL_REPLY_TO")
# Comma-separated inboxes that get an alert for every new contact message
SALES_NOTIFY_EMAILS = [e.strip() for e in os.getenv("SALES_NOTIFY_EMAILS", "").split(",") if e.strip()]
# Newsletter list in Resend (optional): a segment id and/or audience id
RESEND_SEGMENT_ID = os.getenv("RESEND_SEGMENT_ID")
RESEND_AUDIENCE_ID = os.getenv("RESEND_AUDIENCE_ID")

# Display name used with any sender address picked in the CMS ("Blue World Cosmetics <hr@...>")
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "Blue World Cosmetics")
# Extra addresses to suggest in the CMS "Send from" box (comma-separated). Staff can still type any address.
MAIL_SENDERS = [e.strip() for e in os.getenv("MAIL_SENDERS", "").split(",") if e.strip()]

# Sending from a mailbox that is NOT on a domain verified in Resend (e.g. blueworldserve@gmail.com):
# SMTP with an app password. When the chosen sender equals SMTP_USER, the mail goes out through SMTP.
SMTP_HOST = os.getenv("SMTP_HOST")  # Gmail: smtp.gmail.com
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))  # 465 = SSL, 587 = STARTTLS
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

# --- Mailboxes the CMS reads over IMAP (customer replies, applicant replies, mail sent straight to sales@) ---
# Up to four mailboxes. The first uses IMAP_USER / IMAP_PASSWORD (falls back to SMTP_USER / SMTP_PASSWORD);
# extra ones use the same names with a suffix:  IMAP_USER_2, IMAP_PASSWORD_2, IMAP_HOST_2 ... IMAP_USER_4.
# IMAP_HOST is optional: gmail.com addresses use imap.gmail.com, any other address uses mail.<its domain>
# (right for most cPanel hosts). Set it when your mail provider uses another server (Zoho: imap.zoho.com).
_GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}


def _load_imap_accounts() -> list[dict]:
    accounts: list[dict] = []
    for suffix in ("", "_2", "_3", "_4"):
        user = (os.getenv(f"IMAP_USER{suffix}") or (os.getenv("SMTP_USER") if not suffix else "") or "").strip().strip("\"'")
        raw = os.getenv(f"IMAP_PASSWORD{suffix}") or (os.getenv("SMTP_PASSWORD") if not suffix else "") or ""
        if not user or not raw.strip():
            continue
        domain = user.rsplit("@", 1)[-1].lower()
        is_gmail = domain in _GMAIL_DOMAINS
        host = (os.getenv(f"IMAP_HOST{suffix}") or ("imap.gmail.com" if is_gmail else f"mail.{domain}")).strip()
        # Google shows app passwords as "abcd efgh ijkl mnop"; pasted env vars also tend to pick up quotes / newlines.
        password = "".join(raw.split()) if (is_gmail or "gmail.com" in host) else raw.strip()
        password = password.strip("\"'")
        accounts.append(
            {
                "user": user,
                "password": password,
                "host": host,
                "port": int(os.getenv(f"IMAP_PORT{suffix}", "993")),
            }
        )
    return accounts


IMAP_ACCOUNTS = _load_imap_accounts()
# Kept for older code: the first mailbox.
IMAP_HOST = IMAP_ACCOUNTS[0]["host"] if IMAP_ACCOUNTS else os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_USER = IMAP_ACCOUNTS[0]["user"] if IMAP_ACCOUNTS else None
IMAP_PASSWORD = IMAP_ACCOUNTS[0]["password"] if IMAP_ACCOUNTS else None
IMAP_FOLDER = os.getenv("IMAP_FOLDER", "INBOX")
IMAP_POLL_SECONDS = int(os.getenv("IMAP_POLL_SECONDS", "180"))
# How far back each check looks (days), and how far back an email from someone NEW may be to open an inbox thread
# (so the very first check doesn't dump two weeks of old mail into the CMS).
IMAP_LOOKBACK_DAYS = int(os.getenv("IMAP_LOOKBACK_DAYS", "14"))
IMAP_NEW_THREAD_DAYS = int(os.getenv("IMAP_NEW_THREAD_DAYS", "2"))
# Set to "false" to only collect replies from people already in the CMS (contacts / applicants).
IMAP_IMPORT_UNKNOWN = os.getenv("IMAP_IMPORT_UNKNOWN", "true").lower() != "false"

# --- Email branding ---------------------------------------------------------
# Public address of the website, e.g. https://blueworldcosmetics.org (no trailing slash).
# Used for the logo (SITE_URL/blueworld.png) and the buttons inside emails.
SITE_URL = (os.getenv("SITE_URL") or "").strip().rstrip("/")
# Override only if the logo lives somewhere else
MAIL_LOGO_URL = (os.getenv("MAIL_LOGO_URL") or (f"{SITE_URL}/blueworld.png" if SITE_URL else "")).strip()

# --- Job-application alerts to admins + HR ----------------------------------
# Email as soon as this many applications are waiting...
APPLICATION_ALERT_THRESHOLD = int(os.getenv("APPLICATION_ALERT_THRESHOLD", "10"))
# ...and a roundup of whatever is waiting at this hour every day (Lagos time, 24-hour clock).
APPLICATION_DIGEST_HOUR = int(os.getenv("APPLICATION_DIGEST_HOUR", "14"))
# Optional: lets an outside scheduler trigger the roundup (see routers/internal.py). Unset = endpoint disabled.
CRON_SECRET = os.getenv("CRON_SECRET")
# Set to "true" to turn off the built-in 2 PM scheduler (e.g. when you use an outside cron instead).
DISABLE_SCHEDULER = os.getenv("DISABLE_SCHEDULER", "").lower() == "true"




if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set — check that app/.env exists and is being loaded.")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is not set — check that app/.env exists and is being loaded.")
if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
    raise RuntimeError("Cloudinary credentials are incomplete — check CLOUDINARY_* vars in app/.env.")