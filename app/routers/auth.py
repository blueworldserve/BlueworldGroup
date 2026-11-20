from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from core.audit import CRITICAL, record, record_safe
from core.deps import get_db, get_current_user, require_role
from core.permissions import require_admin
from core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from core.limiter import limiter, client_ip
from core import config, login_guard
from models.admin_user import AdminUser, AdminRole, AdminStatus
from schemas.auth import (
    LoginRequest, LoginResponse, AuthTokens, AdminUserOut,
    RefreshRequest, RequestAccessRequest, AccessDecision, RoleChange,
)

router = APIRouter(prefix="/auth", tags=["auth"])
EXPIRES_IN = config.ACCESS_TOKEN_EXPIRE_MINUTES * 60

# Checked when the email does not exist, so "no such user" costs the same time as "wrong password".
# Without it, a fast 401 tells an attacker which emails are real admin accounts.
_DUMMY_HASH = hash_password("this-is-not-a-real-password")


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    ip = client_ip(request)
    if login_guard.is_locked(ip, payload.email):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed attempts. Please wait 15 minutes and try again.")
    user = db.query(AdminUser).filter(AdminUser.email == payload.email).first()
    password_ok = verify_password(payload.password, user.hashed_password if user else _DUMMY_HASH)
    if not user or not password_ok:
        login_guard.register_failure(ip, payload.email)
        record_safe(db, request, None, category=CRITICAL, action="login_failed", resource="auth",
                    summary=f"Failed sign-in attempt for {payload.email}", actor_email=payload.email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    login_guard.clear(ip, payload.email)
    if not user.is_active:
        record_safe(db, request, user, category=CRITICAL, action="login_blocked", resource="auth",
                    summary=f"{user.email} tried to sign in but the account is {user.status.value}")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is inactive")
    record_safe(db, request, user, category=CRITICAL, action="login", resource="auth", summary=f"{user.email} signed in")
    return LoginResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=EXPIRES_IN,
        user=AdminUserOut.model_validate(user),
    )


@router.post("/logout", status_code=204)
def logout(request: Request, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_user)):
    """Tokens are stateless, so this only records the sign-out; the client discards its tokens."""
    record_safe(db, request, current_user, category=CRITICAL, action="logout", resource="auth", summary=f"{current_user.email} signed out")


@router.post("/refresh", response_model=AuthTokens)
@limiter.limit("30/minute")
def refresh(request: Request, payload: RefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if decoded is None or decoded.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = db.query(AdminUser).filter(AdminUser.id == decoded.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return AuthTokens(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=EXPIRES_IN,
    )


@router.get("/me", response_model=AdminUserOut)
def me(current_user: AdminUser = Depends(get_current_user)):
    return current_user


@router.post("/request-access", response_model=AdminUserOut, status_code=201)
@limiter.limit("3/hour")
def request_access(request: Request, payload: RequestAccessRequest, db: Session = Depends(get_db)):
    if payload.requested_role == AdminRole.admin:
        raise HTTPException(400, "Cannot request admin role directly")
    if db.query(AdminUser).filter(AdminUser.email == payload.email).first():
        raise HTTPException(409, "An account with this email already exists")
    user = AdminUser(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.requested_role,
        status=AdminStatus.pending,
        is_superuser=False,
    )
    db.add(user)
    db.flush()
    record(db, request, None, category=CRITICAL, action="access_requested", resource="user", resource_id=user.id,
           summary=f"{user.email} requested {user.role.value} access", actor_email=user.email)
    db.commit()
    db.refresh(user)
    return user


@router.get("/access-requests", response_model=list[AdminUserOut])
def list_access_requests(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    return db.query(AdminUser).filter(AdminUser.status == AdminStatus.pending).all()


@router.post("/access-requests/{user_id}/decision", response_model=AdminUserOut)
def decide_access_request(
    request: Request,
    user_id: str,
    payload: AccessDecision,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user or user.status != AdminStatus.pending:
        raise HTTPException(404, "No pending request for this user")
    if payload.approve:
        user.status = AdminStatus.active
        if payload.role_override:
            user.role = payload.role_override
        record(db, request, admin, category=CRITICAL, action="access_approved", resource="user", resource_id=user.id,
               summary=f"{admin.email} approved {user.email} as {user.role.value}")
    else:
        user.status = AdminStatus.suspended
        record(db, request, admin, category=CRITICAL, action="access_denied", resource="user", resource_id=user.id,
               summary=f"{admin.email} denied access to {user.email}")
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Everyone who has ever been approved or suspended — i.e. not still pending."""
    return (
        db.query(AdminUser)
        .filter(AdminUser.status != AdminStatus.pending)
        .order_by(AdminUser.created_at.desc())
        .all()
    )


@router.post("/users/{user_id}/suspend", response_model=AdminUserOut)
def suspend_user(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    current: AdminUser = Depends(require_admin),
):
    if str(current.id) == user_id:
        raise HTTPException(400, "You cannot suspend your own account")
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_superuser:
        raise HTTPException(403, "The superuser account cannot be suspended")
    user.status = AdminStatus.suspended
    record(db, request, current, category=CRITICAL, action="user_suspended", resource="user", resource_id=user.id,
           summary=f"{current.email} suspended {user.email}")
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reactivate", response_model=AdminUserOut)
def reactivate_user(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.status = AdminStatus.active
    record(db, request, admin, category=CRITICAL, action="user_reactivated", resource="user", resource_id=user.id,
           summary=f"{admin.email} reactivated {user.email}")
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/role", response_model=AdminUserOut)
def change_user_role(
    request: Request,
    user_id: str,
    payload: RoleChange,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Change someone's access level. Admin only; never your own, never the superuser's."""
    if str(admin.id) == user_id:
        raise HTTPException(400, "You cannot change your own access level")
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_superuser:
        raise HTTPException(403, "The superuser's access level cannot be changed")
    if user.role == payload.role:
        return user
    old = user.role
    user.role = payload.role
    record(db, request, admin, category=CRITICAL, action="role_changed", resource="user", resource_id=user.id,
           summary=f"{admin.email} changed {user.email} from {old.value} to {payload.role.value}",
           details={"from": old.value, "to": payload.role.value})
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    current: AdminUser = Depends(require_admin),
):
    if str(current.id) == user_id:
        raise HTTPException(400, "You cannot delete your own account")
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_superuser:
        raise HTTPException(403, "The superuser account cannot be deleted")
    record(db, request, current, category=CRITICAL, action="user_deleted", resource="user", resource_id=user.id,
           summary=f"{current.email} deleted the account {user.email} ({user.role.value})")
    db.delete(user)
    db.commit()