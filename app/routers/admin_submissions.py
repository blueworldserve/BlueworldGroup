import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session, undefer

from core.audit import ACTIVITY, record
from core.deps import get_db
from core.permissions import require_applications_access, require_read, require_write
from core.notify import NotConfigured, NotifyError, build_applicant_email, build_reply_email, send_email, sync_pending_signups
from models.admin_user import AdminRole, AdminUser
from models.submission import (
    ContactReply,
    ContactSubmission,
    CareerApplication,
    CareerApplicationFile,
    NewsletterSignup,
)
from schemas.submission import (
    ApplicationDecisionIn,
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
def list_applications(db: Session = Depends(get_db), _=Depends(require_applications_access)):
    return db.query(CareerApplication).order_by(CareerApplication.created_at.desc()).all()


@router.get("/applications/{application_id}/resume")
def download_resume(
    request: Request,
    application_id: uuid.UUID,
    view: bool = Query(False, description="True when the CMS is showing it on screen rather than downloading it"),
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_applications_access),
):
    """Resumes are personal data: staff-only, never cached, and every download is written to the audit log."""
    application = db.get(CareerApplication, application_id)
    if application is None or application.resume is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No resume on file for this application")
    file = (
        db.query(CareerApplicationFile)
        .options(undefer(CareerApplicationFile.data))
        .filter(CareerApplicationFile.id == application.resume.id)
        .one()
    )
    verb = "viewed" if view else "downloaded"
    record(db, request, user, category=ACTIVITY, action="view_resume" if view else "download_resume", resource="applications",
           resource_id=application.id, summary=f"{user.email} {verb} the resume of {application.full_name} <{application.email}>")
    db.commit()
    return Response(
        content=file.data,
        media_type=file.content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(file.filename)}",
            "Cache-Control": "private, no-store",
        },
    )


def _today_in_lagos():
    return datetime.now(timezone(timedelta(hours=1))).date()


@router.post("/applications/{application_id}/decision", response_model=CareerApplicationOut)
def decide_application(
    request: Request,
    application_id: uuid.UUID,
    payload: ApplicationDecisionIn,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_applications_access),
):
    """Approve (interview invitation) or decline. The email is sent FIRST; the decision is only recorded if
    the email provider accepted it, and an application can only be decided once, so nobody gets two letters."""
    # Lock just this application's row, so a double-click can't send two emails.
    application = (
        db.query(CareerApplication)
        .filter(CareerApplication.id == application_id)
        .with_for_update(of=CareerApplication)
        .first()
    )
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if application.status != "new":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This application was already {application.status}.")

    approving = payload.decision == "approve"
    if approving:
        if payload.interview_date is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please set the interview date before approving.")
        if payload.interview_date < _today_in_lagos():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The interview date can't be in the past.")

    text, html_body = build_applicant_email(body=payload.body)
    try:
        send_email(to=[application.email], subject=payload.subject, text=text, html_body=html_body, reply_to=user.email)
    except NotConfigured as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))
    except NotifyError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"The email provider rejected the message: {e}")

    application.status = "approved" if approving else "declined"
    application.decided_at = datetime.now(timezone.utc)
    application.decided_by = user.email
    application.decision_subject = payload.subject
    application.decision_body = payload.body
    application.interview_date = payload.interview_date if approving else None
    application.interview_time = (payload.interview_time or None) if approving else None
    record(db, request, user, category=ACTIVITY, action="approve_application" if approving else "decline_application",
           resource="applications", resource_id=application.id,
           summary=f"{user.email} {'approved' if approving else 'declined'} {application.full_name} <{application.email}>",
           details={"subject": payload.subject, "interview_date": str(payload.interview_date) if approving else None})
    db.commit()
    db.refresh(application)
    return application


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    request: Request,
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_applications_access),
):
    application = db.get(CareerApplication, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    record(db, request, user, category=ACTIVITY, action="delete_application", resource="applications", resource_id=application.id,
           summary=f"{user.email} deleted the application of {application.full_name} <{application.email}>")
    db.delete(application)  # the resume goes with it
    db.commit()


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