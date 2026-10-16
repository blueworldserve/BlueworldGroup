import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.audit import ACTIVITY, record
from core.deps import get_db
from core.permissions import require_admin, require_read, require_write
from models.admin_user import AdminUser
from models.page import Page, PageBlock, PageStatus
from schemas.page import PageOut, PageCreate

public_router = APIRouter(prefix="/cms/pages", tags=["pages"])
admin_router = APIRouter(prefix="/admin/pages", tags=["admin:pages"])


@public_router.get("/{slug:path}", response_model=PageOut)
def get_page(slug: str, db: Session = Depends(get_db)):
    page = (
        db.query(Page)
        .filter(Page.slug == slug, Page.status == PageStatus.published)
        .first()
    )
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return page


@admin_router.get("", response_model=list[PageOut])
def list_pages(db: Session = Depends(get_db), _=Depends(require_read)):
    return db.query(Page).order_by(Page.slug).all()


@admin_router.get("/{page_id}", response_model=PageOut)
def get_admin_page(page_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(require_read)):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return page


@admin_router.post("", response_model=PageOut, status_code=status.HTTP_201_CREATED)
def create_page(request: Request, payload: PageCreate, db: Session = Depends(get_db), user: AdminUser = Depends(require_write("pages"))):
    if db.query(Page).filter(Page.slug == payload.slug).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")

    data = payload.model_dump(exclude={"blocks"})
    page = Page(**data)
    for i, block in enumerate(payload.blocks):
        page.blocks.append(
            PageBlock(
                type=block.type,
                tone=block.tone,
                order=i,
                payload=block.payload.model_dump(mode="json", by_alias=True),
            )
        )
    db.add(page)
    db.flush()
    record(db, request, user, category=ACTIVITY, action="create", resource="pages", resource_id=page.id,
           summary=f"{user.email} created page “{page.slug}”")
    db.commit()
    db.refresh(page)
    return page


@admin_router.put("/{page_id}", response_model=PageOut)
def update_page(
    request: Request,
    page_id: uuid.UUID,
    payload: PageCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_write("pages")),
):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    fields = payload.model_dump(exclude={"blocks"})
    changed = [f for f, v in fields.items() if str(getattr(page, f, None)) != str(v)]
    blocks_before = len(page.blocks)
    for field, value in fields.items():
        setattr(page, field, value)

    page.blocks.clear()  # cascade="all, delete-orphan" removes the old rows
    db.flush()
    for i, block in enumerate(payload.blocks):
        page.blocks.append(
            PageBlock(
                type=block.type,
                tone=block.tone,
                order=i,
                payload=block.payload.model_dump(mode="json", by_alias=True),
            )
        )
    record(db, request, user, category=ACTIVITY, action="update", resource="pages", resource_id=page.id,
           summary=f"{user.email} edited page “{page.slug}”",
           details={"fields_changed": changed, "blocks": {"from": blocks_before, "to": len(payload.blocks)}})
    db.commit()
    db.refresh(page)
    return page




@admin_router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
# Deleting a whole page is admin/superuser only (the seeded superuser has the admin role).
def delete_page(request: Request, page_id: uuid.UUID, db: Session = Depends(get_db), user: AdminUser = Depends(require_admin)):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    record(db, request, user, category=ACTIVITY, action="delete", resource="pages", resource_id=page.id,
           summary=f"{user.email} deleted page “{page.slug}”")
    db.delete(page)
    db.commit()