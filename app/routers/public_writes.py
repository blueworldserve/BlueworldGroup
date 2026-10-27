import os
import re

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.deps import get_db
from core.limiter import limiter
from core.notify import notify_new_contact, sync_newsletter_signup
from models.submission import (
    CareerApplication,
    CareerApplicationFile,
    ContactSubmission,
    NewsletterSignup,
)
from schemas.submission import ContactSubmissionIn, NewsletterSignupIn

router = APIRouter(tags=["public-writes"])

# How many times one person (same email) may apply for the same role. Set to 1 for "once only".
# The Careers form mentions this number, so change it there too (MAX_APPLICATIONS_PER_ROLE).
MAX_APPLICATIONS_PER_ROLE = 2

# ---- resume uploads ----
RESUME_MAX_BYTES = 5 * 1024 * 1024
# extension -> (content type we store and serve, the bytes a genuine file starts with)
_RESUME_TYPES = {
    ".pdf": ("application/pdf", b"%PDF-"),
    ".docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"PK\x03\x04"),
    ".doc": ("application/msword", b"\xd0\xcf\x11\xe0"),
}


def _clean_filename(name: str) -> str:
    base = os.path.basename((name or "").replace("\\", "/"))
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    return base[:120] or "resume"


# NOTE on slowapi: the endpoint MUST take a parameter literally named `request`,
# and @limiter.limit must sit BELOW the @router decorator.
@router.post("/contact")
@limiter.limit("5/minute;20/hour")
def submit_contact(
    request: Request,
    payload: ContactSubmissionIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Honeypot: real visitors never see this field. Pretend success, save nothing.
    if payload.website:
        return {"ok": True}

    # 1. Save first — the lead is safe even if email/WhatsApp are down or not set up.
    row = ContactSubmission(**payload.model_dump(exclude={"website"}))
    db.add(row)
    db.commit()
    db.refresh(row)

    # 2. Notify afterwards, in the background, so the visitor never waits on it.
    background.add_task(notify_new_contact, row.id)
    return {"ok": True}


@router.post("/careers/apply")
@limiter.limit("3/minute;15/hour")
def submit_application(
    request: Request,
    job_slug: str = Form(..., alias="jobSlug", min_length=1, max_length=120),
    full_name: str = Form(..., alias="fullName", min_length=2, max_length=120),
    email: str = Form(..., min_length=3, max_length=254),
    phone: str | None = Form(None, max_length=40),
    cover_message: str | None = Form(None, alias="coverMessage", max_length=3000),
    resume: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    already = (
        db.query(func.count(CareerApplication.id))
        .filter(CareerApplication.job_slug == job_slug.strip(), func.lower(CareerApplication.email) == email.strip().lower())
        .scalar()
    )
    if already >= MAX_APPLICATIONS_PER_ROLE:
        raise HTTPException(
            409,
            f"You've already applied for this role {already} time{'s' if already != 1 else ''}, which is the most we accept. "
            "We have your details and will be in touch by email.",
        )

    resume_row = None
    if resume is not None and (resume.filename or "").strip():
        name = _clean_filename(resume.filename or "")
        ext = os.path.splitext(name)[1].lower()
        if ext not in _RESUME_TYPES:
            raise HTTPException(415, "Please upload your resume as a PDF, DOC or DOCX file.")
        data = resume.file.read(RESUME_MAX_BYTES + 1)
        if len(data) > RESUME_MAX_BYTES:
            raise HTTPException(413, "That file is larger than 5 MB. Please upload a smaller version.")
        if not data:
            raise HTTPException(400, "That file looks empty. Please choose your resume again.")
        content_type, magic = _RESUME_TYPES[ext]
        if not data.startswith(magic):
            raise HTTPException(415, "That file doesn't look like a real PDF or Word document.")
        resume_row = CareerApplicationFile(filename=name, content_type=content_type, size=len(data), data=data)

    application = CareerApplication(
        job_slug=job_slug.strip(),
        full_name=full_name.strip(),
        email=email.strip().lower(),  # stored lower-case so the repeat-application check can't be dodged by capitals
        phone=(phone or "").strip() or None,
        cover_message=cover_message,
    )
    if resume_row is not None:
        application.resume = resume_row
    db.add(application)
    db.commit()
    return {"ok": True}


@router.post("/newsletter/subscribe")
@limiter.limit("5/minute;30/hour")
def subscribe_newsletter(
    request: Request,
    payload: NewsletterSignupIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if payload.website:  # honeypot
        return {"ok": True}

    email = payload.email.strip().lower()
    existing = db.query(NewsletterSignup).filter(NewsletterSignup.email == email).first()
    if existing is None:
        row = NewsletterSignup(email=email)
        db.add(row)
        db.commit()
        db.refresh(row)
        background.add_task(sync_newsletter_signup, row.id)
    # Same response whether or not they were already subscribed (don't leak who is on the list).
    return {"ok": True}