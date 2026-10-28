import uuid
from datetime import date, datetime, timezone
from sqlalchemy import Date, Integer, LargeBinary, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from db.base import Base


class ContactSubmission(Base):
    __tablename__ = "contact_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    enquiry_type: Mapped[str] = mapped_column(String, nullable=False, default="General", server_default="General")
    subject: Mapped[str] = mapped_column(String, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # "new" -> "read" (opened in the CMS) -> "replied" (a reply was sent from the CMS)
    status: Mapped[str] = mapped_column(String, nullable=False, default="new", server_default="new")
    replied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ContactReply(Base):
    """A reply sent from the CMS inbox. Kept so the thread history is never lost."""

    __tablename__ = "contact_replies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contact_submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_email: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_by: Mapped[str] = mapped_column(String, nullable=True)  # CMS user's email
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class CareerApplication(Base):
    __tablename__ = "career_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_slug: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    cover_message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Hiring decision. "new" -> "approved" (interview invitation sent) or "declined" (rejection sent).
    status: Mapped[str] = mapped_column(String, nullable=False, default="new", server_default="new")
    interview_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    interview_time: Mapped[str | None] = mapped_column(String, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[str | None] = mapped_column(String, nullable=True)  # the staff member's email
    decision_subject: Mapped[str | None] = mapped_column(String, nullable=True)
    decision_body: Mapped[str | None] = mapped_column(Text, nullable=True)  # exactly what was emailed

    # Set when admins/HR were told about this application (threshold alert or daily digest).
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # The optional resume. Loaded together with the application, but the file's bytes
    # themselves are deferred (see CareerApplicationFile.data), so listing applications stays light.
    resume: Mapped["CareerApplicationFile | None"] = relationship(
        back_populates="application", uselist=False, lazy="joined", cascade="all, delete-orphan"
    )

    @property
    def resume_filename(self) -> str | None:
        return self.resume.filename if self.resume else None

    @property
    def resume_size(self) -> int | None:
        return self.resume.size if self.resume else None


class CareerApplicationFile(Base):
    """A resume uploaded with a job application. Stored privately in the database and only
    ever served to signed-in staff — there is no public link to it."""

    __tablename__ = "career_application_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("career_applications.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    filename: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, deferred=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    application: Mapped["CareerApplication"] = relationship(back_populates="resume")


class NewsletterSignup(Base):
    __tablename__ = "newsletter_signups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    # Set once the address has been pushed to the Resend list (stays NULL until Resend is configured)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )