import uuid
from datetime import datetime, date
from typing import Annotated, Literal

from pydantic import EmailStr, StringConstraints

from schemas.base import CamelModel

# One place to change the contact message limit (the frontend counter mirrors it).
MESSAGE_MAX_LENGTH = 800

EnquiryType = Literal["Sales", "Distribution", "Private label", "Export", "General"]

# Trimmed strings with length limits. Plain aliases (not function calls) so type checkers understand them.
Text_1_120 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Text_2_120 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Text_2_150 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]
Text_2_200 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
Text_2_5000 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=5000)]
Text_3_200 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
Text_3_254 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=254)]
Text_20_5000 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=5000)]
MessageText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=5, max_length=MESSAGE_MAX_LENGTH)
]
ShortOptional = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]


class ContactSubmissionIn(CamelModel):
    full_name: Text_2_120
    email: EmailStr
    phone: ShortOptional | None = None
    enquiry_type: EnquiryType = "General"
    subject: Text_2_150
    message: MessageText
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
    subject: Text_2_200
    body: Text_2_5000


class CareerApplicationIn(CamelModel):
    job_slug: Text_1_120
    full_name: Text_2_120
    email: Text_3_254
    phone: ShortOptional | None = None
    cover_message: Annotated[str, StringConstraints(max_length=3000)] | None = None


class CareerApplicationOut(CamelModel):
    id: uuid.UUID
    created_at: datetime
    job_slug: str
    full_name: str
    email: str
    phone: str | None = None
    cover_message: str | None = None
    resume_filename: str | None = None
    resume_size: int | None = None
    status: str = "new"
    interview_date: date | None = None
    interview_time: str | None = None
    decided_at: datetime | None = None
    decided_by: str | None = None
    decision_subject: str | None = None
    decision_body: str | None = None


class ApplicationDecisionIn(CamelModel):
    """HR's decision on an application, with the exact email to send (they can edit it first)."""

    decision: Literal["approve", "decline"]
    subject: Text_3_200
    body: Text_20_5000
    interview_date: date | None = None
    interview_time: ShortOptional | None = None


class NewsletterSignupIn(CamelModel):
    email: EmailStr
    website: str | None = None  # honeypot


class NewsletterSignupOut(CamelModel):
    id: uuid.UUID
    email: str
    synced_at: datetime | None = None
    created_at: datetime