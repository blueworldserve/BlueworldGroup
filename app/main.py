from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core import config
from routers import auth, cms_public, public_writes, admin_audit, admin_business_units, admin_media, admin_settings, admin_submissions, pages, internal, analytics
from routers.admin_generic import make_admin_crud_router

from models.hero_slide import HeroSlide
from models.product import Product
from models.team_member import TeamMember
from models.blog_post import BlogPost
from models.job_posting import JobPosting
from models.country_showcase import CountryShowcase
from models.company_app import CompanyApp


from sqlalchemy import text
from schemas.hero_slide import HeroSlideOut, HeroSlideCreate
from schemas.product import ProductOut, ProductCreate
from schemas.team_member import TeamMemberOut, TeamMemberCreate
from schemas.blog_post import BlogPostOut, BlogPostCreate


from schemas.job_posting import JobPostingOut, JobPostingCreate
from schemas.country_showcase import CountryShowcaseOut, CountryShowcaseCreate
from schemas.company_app import CompanyAppOut, CompanyAppCreate

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.limiter import limiter
from db.session import engine

import os
import logging

logger = logging.getLogger("startup")

# Interactive API docs list every admin endpoint, so they're OFF unless you set ENABLE_DOCS=true.
_docs_on = os.getenv("ENABLE_DOCS", "").lower() == "true"
app = FastAPI(
    title="Blueworld Cosmetics API",
    docs_url="/docs" if _docs_on else None,
    redoc_url="/redoc" if _docs_on else None,
    openapi_url="/openapi.json" if _docs_on else None,
)


# Public endpoints never need big requests, so refuse oversized ones up front (the careers form
# is the exception: it can carry a resume of up to 5 MB).
_BODY_LIMITS = {
    "/careers/apply": 6 * 1024 * 1024,
    "/contact": 64 * 1024,
    "/newsletter/subscribe": 64 * 1024,
    "/auth/login": 64 * 1024,
    "/auth/request-access": 64 * 1024,
    "/analytics/collect": 32 * 1024,
    "/admin/media/upload": 25 * 1024 * 1024,
}


@app.middleware("http")
async def add_security_headers(request, call_next):
    limit = _BODY_LIMITS.get(request.url.path)
    declared = request.headers.get("content-length")
    if limit is not None and declared and declared.isdigit() and int(declared) > limit:
        return JSONResponse({"detail": "That request is too large."}, status_code=413)
    response = await call_next(request)
    path = request.url.path
    if path.startswith(("/admin", "/auth")):
        # Private data: no browser, proxy or CDN may keep a copy.
        response.headers["Cache-Control"] = "no-store"
    elif request.method == "GET" and path.startswith("/cms/") and response.status_code == 200:
        # Public content: a CDN may reuse it for 60s and, if this API is down, serve the last copy for a day.
        # max-age=0 keeps browsers asking, so the CMS shows an edit straight after saving.
        response.headers.setdefault(
            "Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400"
        )
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Strict-Transport-Security", "max-age=15552000")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth.router)
app.include_router(cms_public.router)
app.include_router(public_writes.router)
app.include_router(admin_business_units.router)
app.include_router(admin_media.router)
app.include_router(admin_settings.router)
app.include_router(admin_submissions.router)
app.include_router(admin_audit.router)
app.include_router(internal.router)
app.include_router(analytics.public_router)
app.include_router(analytics.admin_router)
app.include_router(pages.public_router)
app.include_router(pages.admin_router)

app.include_router(make_admin_crud_router("hero-slides", HeroSlide, HeroSlideOut, HeroSlideCreate))
app.include_router(make_admin_crud_router("products", Product, ProductOut, ProductCreate))
app.include_router(make_admin_crud_router("team", TeamMember, TeamMemberOut, TeamMemberCreate))
app.include_router(make_admin_crud_router("blog-posts", BlogPost, BlogPostOut, BlogPostCreate))
app.include_router(make_admin_crud_router("jobs", JobPosting, JobPostingOut, JobPostingCreate))
app.include_router(make_admin_crud_router("country-showcases", CountryShowcase, CountryShowcaseOut, CountryShowcaseCreate))
app.include_router(make_admin_crud_router("company-apps", CompanyApp, CompanyAppOut, CompanyAppCreate))

@app.on_event("startup")
def run_startup_tasks():
    # 1. Run migrations, safe to call every boot; alembic no-ops if already at head
    try:
        from alembic.config import Config
        from alembic import command

        base_dir = os.path.dirname(os.path.abspath(__file__))
        alembic_ini_path = os.path.join(base_dir, "alembic.ini")

        alembic_cfg = Config(alembic_ini_path)
        alembic_cfg.set_main_option("script_location", os.path.join(base_dir, "alembic"))

        logger.info("Running alembic migrations...")
        command.upgrade(alembic_cfg, "head")
        logger.info("Migrations complete.")
    except Exception:
        logger.exception("Migration step failed on startup")
        raise  # fail loudly, don't let the app serve traffic against an unmigrated DB

    # 2. Make sure a superuser exists, no-ops if one already exists (login bootstrap only, no site content)
    try:
        from scripts.seed_superuser import seed_superuser
        seed_superuser(interactive=False)
    except Exception:
        logger.exception("Superuser seed step failed on startup")
        # not re-raised: a missing superuser shouldn't take the whole app down

    # 3. Start the daily applications roundup (2 PM Lagos time by default)
    try:
        from core.scheduler import start_scheduler
        start_scheduler()
    except Exception:
        logger.exception("Scheduler failed to start")


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}


@app.api_route("/health/db", methods=["GET", "HEAD"])
@limiter.limit("30/minute")
def health_db(request: Request):
    """Like /health, but also proves the database answers. Point your uptime monitor here."""
    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
    except Exception:
        logger.exception("Health check: database unreachable")
        return JSONResponse({"status": "database_unreachable"}, status_code=503)
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Welcome to the Blueworld Cosmetics API!"}