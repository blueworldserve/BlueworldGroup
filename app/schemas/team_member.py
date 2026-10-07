import uuid

from schemas.base import CamelModel


class TeamMemberBase(CamelModel):
    name: str
    slug: str | None = None
    role: str
    bio: str | None = None
    photo: str | None = None
    order: int = 0
    is_featured: bool = False


class TeamMemberCreate(TeamMemberBase):
    pass


class TeamMemberOut(TeamMemberBase):
    id: uuid.UUID