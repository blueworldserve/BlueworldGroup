import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import EmailStr, Field, StringConstraints

from schemas.base import CamelModel

# One place to change the contact message limit (the frontend counter mirrors it).
MESSAGE_MAX_LENGTH = 800

EnquiryType = Literal["Sales", "Distribution", "Private label", "Export", "General"]


def _text(min_length: int, max_length: int):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)]


class ContactSubmissionIn(CamelModel):
    full_name: _text(2, 120)
    email: EmailStr
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None = None
    enquiry_type: EnquiryType = "General"
    subject: _text(2, 150)
    message: _text(5, MESSAGE_MAX_LENGTH)
    # Honeypot: a hidden field real visitors never fill in. Bots do.
    website: str | None = None


class ContactReplyOut(CamelModel):
    id: uuid.UUID
    to_email: str
    subject: str
    body: str
    sent_by: str | None = None
    sent_at: datetime


class ContactSubmissionOut(CamelModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None = None
    enquiry_type: str
    subject: str | None = None
    message: str
    status: str
    replied_at: datetime | None = None
    created_at: datetime


class ContactSubmissionDetailOut(ContactSubmissionOut):
    replies: list[ContactReplyOut] = []


class ContactReplyIn(CamelModel):
    subject: _text(2, 200)
    body: _text(2, 5000)


class CareerApplicationIn(CamelModel):
    job_slug: str
    full_name: str
    email: str
    phone: str | None = None
    cover_message: str | None = None


class CareerApplicationOut(CareerApplicationIn):
    id: uuid.UUID
    created_at: datetime


class NewsletterSignupIn(CamelModel):
    email: EmailStr
    website: str | None = None  # honeypot


class NewsletterSignupOut(CamelModel):
    id: uuid.UUID
    email: str
    synced_at: datetime | None = None
    created_at: datetime