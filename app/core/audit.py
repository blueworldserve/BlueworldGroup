import json
import logging
from enum import Enum
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from core.limiter import client_ip
from models.audit_log import AuditLog

logger = logging.getLogger("audit")

CRITICAL = "critical"   # logins, logouts, access + role changes, resets
ACTIVITY = "activity"   # edits to content / settings / inbox

_NEVER_LOG = {"password", "hashed_password", "token", "access_token", "refresh_token"}
_MAX = 300


def _plain(value: Any) -> Any:
    if isinstance(value, Enum):
        value = value.value
    try:
        value = json.loads(json.dumps(value, default=str))
    except Exception:
        value = str(value)
    if isinstance(value, str) and len(value) > _MAX:
        return value[:_MAX] + "…"
    if isinstance(value, (list, dict)) and len(json.dumps(value)) > _MAX:
        return f"<{type(value).__name__} · {len(value)} item(s)>"
    return value


def snapshot(obj, fields) -> dict:
    return {f: _plain(getattr(obj, f, None)) for f in fields if f not in _NEVER_LOG}


def diff(before: dict, after: dict) -> dict:
    return {
        k: {"from": before.get(k), "to": _plain(after[k])}
        for k in after
        if k not in _NEVER_LOG and before.get(k) != _plain(after[k])
    }


def label(obj) -> str:
    for attr in ("title", "name", "full_name", "subject", "slug", "email", "id"):
        v = getattr(obj, attr, None)
        if v:
            return str(v)
    return "item"


def record(db: Session, request: Request | None, user, *, category: str, action: str, summary: str,
           resource: str | None = None, resource_id: Any = None, details: dict | None = None,
           actor_email: str | None = None) -> None:
    """Adds the audit row to the CURRENT session, so it commits (or rolls back) together with the change."""
    db.add(AuditLog(
        category=category, action=action, resource=resource,
        resource_id=str(resource_id) if resource_id is not None else None,
        summary=summary[:1000],
        actor_id=getattr(user, "id", None),
        actor_email=getattr(user, "email", None) or actor_email,
        actor_role=("superuser" if getattr(user, "is_superuser", False) else getattr(getattr(user, "role", None), "value", None)),
        ip=client_ip(request) if request is not None else None,
        user_agent=(request.headers.get("user-agent", "")[:300] if request is not None else None),
        details=details or None,
    ))


def record_safe(*args, **kwargs) -> None:
    """For login/logout: a logging hiccup must never lock people out."""
    db = args[0]
    try:
        record(*args, **kwargs)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Could not write audit entry")