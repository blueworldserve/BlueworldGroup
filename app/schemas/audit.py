import uuid
from datetime import datetime

from schemas.base import CamelModel


class AuditLogOut(CamelModel):
    id: uuid.UUID
    created_at: datetime
    category: str
    action: str
    resource: str | None = None
    resource_id: str | None = None
    summary: str
    actor_email: str | None = None
    actor_role: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    details: dict | None = None


class AuditPage(CamelModel):
    items: list[AuditLogOut]
    total: int