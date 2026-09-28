import uuid

from schemas.base import CamelModel


class CountryShowcaseBase(CamelModel):
    name: str
    place: str
    headline: str
    blurb: str
    detail: str
    stat_value: str
    stat_label: str
    points: list[str] = []
    image: str | None = None
    video: str | None = None
    tint: str | None = None
    order: int = 0


class CountryShowcaseCreate(CountryShowcaseBase):
    pass


class CountryShowcaseOut(CountryShowcaseBase):
    id: uuid.UUID