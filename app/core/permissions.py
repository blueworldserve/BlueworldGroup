from fastapi import Depends, HTTPException, status

from core.deps import get_current_user, require_role
from models.admin_user import AdminRole as R, AdminUser

ALL_ROLES = (R.admin, R.editor, R.sales, R.hr, R.viewer)

# resource -> roles allowed to create/edit/delete. Everyone can READ everything.
WRITE_ROLES: dict[str, tuple[R, ...]] = {
    "hero-slides":       (R.admin, R.editor),
    "business-units":    (R.admin, R.editor),
    "pages":             (R.admin, R.editor),
    "country-showcases": (R.admin, R.editor),
    "team":              (R.admin, R.editor),
    "settings":          (R.admin, R.editor),
    "media":             (R.admin, R.editor),
    "media-upload":      (R.admin, R.editor, R.sales),
    "products":          (R.admin, R.editor, R.sales),
    "blog-posts":        (R.admin, R.editor, R.sales),
    "jobs":              (R.admin, R.editor, R.hr),
    "inbox":             (R.admin, R.editor, R.sales),
}

require_read = require_role(*ALL_ROLES)
require_admin = require_role(R.admin)


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