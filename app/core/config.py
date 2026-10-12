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

# --- WhatsApp Business Cloud API (Meta) — optional alert to your sales number ---
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")                  # permanent system-user token
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
WHATSAPP_NOTIFY_TO = [n.strip().lstrip("+") for n in os.getenv("WHATSAPP_NOTIFY_TO", "").split(",") if n.strip()]
WHATSAPP_TEMPLATE_NAME = os.getenv("WHATSAPP_TEMPLATE_NAME", "new_website_enquiry")
WHATSAPP_TEMPLATE_LANG = os.getenv("WHATSAPP_TEMPLATE_LANG", "en")
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v25.0")





if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set — check that app/.env exists and is being loaded.")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is not set — check that app/.env exists and is being loaded.")
if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
    raise RuntimeError("Cloudinary credentials are incomplete — check CLOUDINARY_* vars in app/.env.")