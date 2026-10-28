from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.deps import get_db
from core.permissions import require_admin
from models.audit_log import AuditLog
from schemas.audit import AuditLogOut, AuditPage

router = APIRouter(prefix="/admin/audit", tags=["admin-audit"])


@router.get("", response_model=AuditPage)
def list_audit(
    category: str | None = Query(None, pattern="^(critical|activity)$"),
    q: str | None = Query(None, max_length=100),
    since: datetime | None = Query(None, description="Only entries at or after this time"),
    until: datetime | None = Query(None, description="Only entries before this time"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    query = db.query(AuditLog)
    if category:
        query = query.filter(AuditLog.category == category)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(AuditLog.summary.ilike(like), AuditLog.actor_email.ilike(like),
                                 AuditLog.resource.ilike(like), AuditLog.action.ilike(like)))
    if since:
        query = query.filter(AuditLog.created_at >= since)
    if until:
        query = query.filter(AuditLog.created_at < until)
    total = query.count()
    rows = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return AuditPage(items=[AuditLogOut.model_validate(r) for r in rows], total=total)