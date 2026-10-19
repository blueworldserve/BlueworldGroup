from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import config
from routers import auth, cms_public, public_writes, admin_audit, admin_business_units, admin_media, admin_settings, admin_submissions, admin_system, pages
from routers.admin_generic import make_admin_crud_router

from models.hero_slide import HeroSlide
from models.product import Product
from models.team_member import TeamMember
from models.blog_post import BlogPost
from models.job_posting import JobPosting
from models.job_posting import JobPosting
from models.country_showcase import CountryShowcase




from schemas.hero_slide import HeroSlideOut, HeroSlideCreate
from schemas.product import ProductOut, ProductCreate
from schemas.team_member import TeamMemberOut, TeamMemberCreate
from schemas.blog_post import BlogPostOut, BlogPostCreate


from schemas.job_posting import JobPostingOut, JobPostingCreate
from schemas.country_showcase import CountryShowcaseOut, CountryShowcaseCreate

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.limiter import limiter

import os
import logging

logger = logging.getLogger("startup")

# Interactive API docs list every admin endpoint, so they're OFF unless you set ENABLE_DOCS=true.
_docs_on = os.getenv("ENABLE_DOCS", "").lower() == "true"
app = FastAPI(
    title="BlueWorld Cosmetics API",
    docs_url="/docs" if _docs_on else None,
    redoc_url="/redoc" if _docs_on else None,
    openapi_url="/openapi.json" if _docs_on else None,
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Strict-Transport-Security", "max-age=15552000")
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
app.include_router(admin_system.router)
app.include_router(pages.public_router)
app.include_router(pages.admin_router)

app.include_router(make_admin_crud_router("hero-slides", HeroSlide, HeroSlideOut, HeroSlideCreate))
app.include_router(make_admin_crud_router("products", Product, ProductOut, ProductCreate))
app.include_router(make_admin_crud_router("team", TeamMember, TeamMemberOut, TeamMemberCreate))
app.include_router(make_admin_crud_router("blog-posts", BlogPost, BlogPostOut, BlogPostCreate))
app.include_router(make_admin_crud_router("jobs", JobPosting, JobPostingOut, JobPostingCreate))
app.include_router(make_admin_crud_router("country-showcases", CountryShowcase, CountryShowcaseOut, CountryShowcaseCreate))

@app.on_event("startup")
def run_startup_tasks():
    # 1. Run migrations — safe to call every boot; alembic no-ops if already at head
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
        raise  # fail loudly — don't let the app serve traffic against an unmigrated DB

        # 2. Seed superuser — no-ops if one already exists
    try:
        from scripts.seed_superuser import seed_superuser
        seed_superuser(interactive=False)
    except Exception:
        logger.exception("Superuser seed step failed on startup")
        # not re-raised: a missing superuser shouldn't take the whole app down

    # 3. Seed country showcase content — no-ops per-country if it already exists
    try:
        from scripts.seed_country_showcase import main as seed_country_showcase
        seed_country_showcase()
    except Exception:
        logger.exception("Country showcase seed step failed on startup")
        # not re-raised: same reasoning as the superuser seed above


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Welcome to the BlueWorld Cosmetics API!"}


from fastapi import Request

@app.get("/debug-ip")
def debug_ip(request: Request):
    return {
        "client_host": request.client.host if request.client else None,
        "x_forwarded_for": request.headers.get("x-forwarded-for"),
    }