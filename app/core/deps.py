import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db.session import SessionLocal
from core.security import decode_token
from models.admin_user import AdminUser, AdminRole

bearer_scheme = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AdminUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = credentials.credentials
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(str(user_id))
    except (ValueError, AttributeError):
        raise credentials_exception  # a token whose subject is not a real user id is simply invalid, never a 500

    user = db.query(AdminUser).filter(AdminUser.id == user_uuid).first()
    if user is None or not user.is_active:
        raise credentials_exception
    if payload.get("tv", 0) != user.token_version:
        raise credentials_exception  # signed out, suspended or reset since this token was issued
    return user


def require_role(*allowed_roles: AdminRole):
    def _checker(user: AdminUser = Depends(get_current_user)) -> AdminUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return user

    return _checker


# Convenience alias: any admin-level content endpoint that editors should
# also be able to use (not just full admins).
require_editor = require_role(AdminRole.admin, AdminRole.editor)