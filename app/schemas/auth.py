import uuid
from datetime import datetime

from pydantic import EmailStr, Field, computed_field

from models.admin_user import AdminRole, AdminStatus
from schemas.base import CamelModel
from core.permissions import writable_resources


class LoginRequest(CamelModel):
    email: EmailStr
    password: str


class AdminUserOut(CamelModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    role: AdminRole
    status: AdminStatus
    is_superuser: bool
    created_at: datetime

    @computed_field
    @property
    def writable(self) -> list[str]:
        return writable_resources(self.role, self.is_superuser)


class LoginResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AdminUserOut


class AuthTokens(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(CamelModel):
    refresh_token: str | None = None  # empty when the refresh token travels in the httpOnly cookie


class RequestAccessRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    requested_role: AdminRole


class RoleChange(CamelModel):
    role: AdminRole


class AccessDecision(CamelModel):
    approve: bool
    role_override: AdminRole | None = None