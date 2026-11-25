import uuid

from pydantic import Field, field_validator

from schemas.base import CamelModel


class CompanyAppBase(CamelModel):
    name: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=300)
    icon: str | None = Field(default=None, max_length=500)
    order: int = 0

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Give the app a name")
        return v

    @field_validator("url")
    @classmethod
    def _web_link_only(cls, v: str) -> str:
        # The launcher turns this into a clickable link, so only real web links are allowed
        # (no javascript: or data: links that could run code when an admin clicks them).
        v = v.strip()
        if not v.lower().startswith(("http://", "https://")) or " " in v:
            raise ValueError("The link must start with http:// or https://")
        return v

    @field_validator("description")
    @classmethod
    def _clean_description(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None

    @field_validator("icon")
    @classmethod
    def _icon_is_an_image_link(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        if not v:
            return None
        if not v.lower().startswith(("http://", "https://", "/")) or v.startswith("//") or " " in v:
            raise ValueError("The icon must be an image link (https://…) or a Media Library path")
        return v


class CompanyAppCreate(CompanyAppBase):
    pass


class CompanyAppOut(CompanyAppBase):
    id: uuid.UUID
