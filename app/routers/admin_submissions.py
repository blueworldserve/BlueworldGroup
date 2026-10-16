import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.audit import ACTIVITY, record
from core.deps import get_db
from core.permissions import require_read, require_write
from core.notify import NotConfigured, NotifyError, build_reply_email, send_email, sync_pending_signups
from models.admin_user import AdminRole, AdminUser
from models.submission import ContactReply, ContactSubmission, CareerApplication, NewsletterSignup
from schemas.submission import (
    CareerApplicationOut,
    ContactReplyIn,
    ContactReplyOut,
    ContactSubmissionDetailOut,
    ContactSubmissionOut,
    NewsletterSignupOut,
)

router = APIRouter(prefix="/admin/submissions", tags=["admin-submissions"])

# Everyone with CMS access can READ the inbox; only admins/editors/sales can change it or reply.
_can_view = require_read
_can_manage = require_write("inbox")


def _get_or_404(db: Session, message_id: uuid.UUID) -> ContactSubmission:
    row = db.get(ContactSubmission, message_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    return row


def _detail(db: Session, row: ContactSubmission) -> ContactSubmissionDetailOut:
    replies = (
        db.query(ContactReply)
        .filter(ContactReply.submission_id == row.id)
        .order_by(ContactReply.sent_at)
        .all()
    )
    out = ContactSubmissionDetailOut.model_validate(row)
    out.replies = [ContactReplyOut.model_validate(r) for r in replies]
    return out


# ------------------------------- contact inbox ------------------------------- #
@router.get("/contact", response_model=list[ContactSubmissionOut])
def list_contact_submissions(db: Session = Depends(get_db), _=Depends(_can_view)):
    return db.query(ContactSubmission).order_by(ContactSubmission.created_at.desc()).all()


@router.get("/contact/{message_id}", response_model=ContactSubmissionDetailOut)
def get_contact_submission(message_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_can_view)):
    return _detail(db, _get_or_404(db, message_id))


@router.post("/contact/{message_id}/read", response_model=ContactSubmissionOut)
def mark_contact_read(message_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_can_manage)):
    """Opening a message in the inbox flags it read (only if it was still 'new')."""
    row = _get_or_404(db, message_id)
    if row.status == "new":
        row.status = "read"
        db.commit()
        db.refresh(row)
    return row


@router.post("/contact/{message_id}/reply", response_model=ContactSubmissionDetailOut)
def reply_to_contact(
    request: Request,
    message_id: uuid.UUID,
    payload: ContactReplyIn,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(_can_manage),
):
    row = _get_or_404(db, message_id)
    text, html_body = build_reply_email(
        body=payload.body,
        original_name=row.full_name,
        original_message=row.message,
        original_at=row.created_at,
    )
    try:
        send_email(
            to=[row.email],
            subject=payload.subject,
            text=text,
            html_body=html_body,
            reply_to=_reply_to_address(),
        )
    except NotConfigured as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))
    except NotifyError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"The email provider rejected the message: {e}")

    # Only record the reply once the provider has accepted it.
    db.add(
        ContactReply(
            submission_id=row.id,
            to_email=row.email,
            subject=payload.subject,
            body=payload.body,
            sent_by=user.email,
        )
    )
    row.status = "replied"
    row.replied_at = datetime.now(timezone.utc)
    record(db, request, user, category=ACTIVITY, action="reply", resource="inbox", resource_id=row.id,
           summary=f"{user.email} replied to {row.full_name} <{row.email}>",
           details={"subject": payload.subject})
    db.commit()
    db.refresh(row)
    return _detail(db, row)


def _reply_to_address() -> str | None:
    from core import config

    return config.MAIL_REPLY_TO or (config.SALES_NOTIFY_EMAILS[0] if config.SALES_NOTIFY_EMAILS else None)


@router.delete("/contact/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact_submission(request: Request, message_id: uuid.UUID, db: Session = Depends(get_db), user: AdminUser = Depends(_can_manage)):
    row = _get_or_404(db, message_id)
    record(db, request, user, category=ACTIVITY, action="delete", resource="inbox", resource_id=row.id,
           summary=f"{user.email} deleted the message from {row.full_name} <{row.email}>")
    db.query(ContactReply).filter(ContactReply.submission_id == row.id).delete()
    db.delete(row)
    db.commit()


# --------------------------------- careers ---------------------------------- #
@router.get("/applications", response_model=list[CareerApplicationOut])
def list_applications(db: Session = Depends(get_db), _=Depends(_can_view)):
    return db.query(CareerApplication).order_by(CareerApplication.created_at.desc()).all()


# -------------------------------- newsletter -------------------------------- #
@router.get("/newsletter", response_model=list[NewsletterSignupOut])
def list_newsletter_signups(db: Session = Depends(get_db), _=Depends(_can_view)):
    return db.query(NewsletterSignup).order_by(NewsletterSignup.created_at.desc()).all()


@router.post("/newsletter/sync")
def sync_newsletter(request: Request, db: Session = Depends(get_db), user: AdminUser = Depends(_can_manage)):
    """Pushes subscribers that haven't reached Resend yet (e.g. everyone who signed up before the keys existed)."""
    try:
        record(db, request, user, category=ACTIVITY, action="sync", resource="inbox", summary=f"{user.email} synced newsletter subscribers")
        db.commit()
        return sync_pending_signups(db)
    except NotConfigured as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))