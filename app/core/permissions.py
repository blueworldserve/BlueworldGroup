"""
Single source of truth for "who may change what".

The CMS frontend receives the result as `writable` on /auth/me and /auth/login,
so the buttons it shows can never drift from what the API actually enforces.
Every role can READ every section; this table only controls WRITES.
"""
from fastapi import Depends, HTTPException, status

from core.deps import get_current_user, require_role
from models.admin_user import AdminRole as R, AdminUser

ALL_ROLES = (R.admin, R.editor, R.sales, R.hr, R.viewer)

# resource key -> roles allowed to create / edit / delete in it (admin is always included)
WRITE_ROLES: dict[str, tuple[R, ...]] = {
    "hero-slides":       (R.admin, R.editor),
    "business-units":    (R.admin, R.editor),
    "pages":             (R.admin, R.editor),
    "country-showcases": (R.admin, R.editor),
    "team":              (R.admin, R.editor),
    "settings":          (R.admin, R.editor),
    "media":             (R.admin, R.editor),             # rename / delete library items
    "media-upload":      (R.admin, R.editor, R.sales),    # upload / register images (sales need it for products + blog covers)
    "products":          (R.admin, R.editor, R.sales),
    "blog-posts":        (R.admin, R.editor, R.sales),
    "jobs":              (R.admin, R.editor, R.hr),
    "inbox":             (R.admin, R.editor, R.sales),
}

require_read = require_role(*ALL_ROLES)
require_admin = require_role(R.admin)
# Applicants' details and resumes are personal data: only people who hire may see them.
require_applications_access = require_role(R.admin, R.editor, R.hr)


def require_write(resource: str):
    return require_role(*WRITE_ROLES[resource])


def require_superuser(user: AdminUser = Depends(get_current_user)) -> AdminUser:
    if not user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the superuser can do this")
    return user


def writable_resources(role: R, is_superuser: bool = False) -> list[str]:
    if is_superuser or role == R.admin:
        return sorted(WRITE_ROLES)
    return sorted(k for k, roles in WRITE_ROLES.items() if role in roles)