from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session

from core.deps import get_db
from core.limiter import limiter
from core.notify import notify_new_contact, sync_newsletter_signup
from models.submission import ContactSubmission, CareerApplication, NewsletterSignup
from schemas.submission import ContactSubmissionIn, CareerApplicationIn, NewsletterSignupIn

router = APIRouter(tags=["public-writes"])


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
@limiter.limit("5/minute;30/hour")
def submit_application(request: Request, payload: CareerApplicationIn, db: Session = Depends(get_db)):
    db.add(CareerApplication(**payload.model_dump()))
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