from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from core.deps import get_db, require_role
from models.admin_user import AdminRole
from models.page import Page, PageBlock
from schemas.page import PageOut, PageInput

router = APIRouter(prefix="/admin/pages", tags=["admin-pages"])
public_router = APIRouter(prefix="/cms/pages", tags=["cms-public"])


def _to_out(page: Page) -> PageOut:
    return PageOut(
        id=page.id,
        slug=page.slug,
        title=page.title,
        eyebrow=page.eyebrow,
        description=page.description,
        heroImage=page.hero_image,
        metaTitle=page.meta_title,
        metaDescription=page.meta_description,
        status=page.status,
        blocks=list(page.blocks),
    )


def _apply_input(page: Page, payload: PageInput, db: Session):
    page.slug = payload.slug
    page.title = payload.title
    page.eyebrow = payload.eyebrow
    page.description = payload.description
    page.hero_image = payload.heroImage
    page.meta_title = payload.metaTitle
    page.meta_description = payload.metaDescription
    page.status = payload.status

    # Replace all blocks wholesale, simplest correct behavior for a page editor
    # that submits its full block list on every save.
    page.blocks.clear()
    db.flush()
    for b in payload.blocks:
        page.blocks.append(
            PageBlock(type=b.type, tone=b.tone, order=b.order, payload=b.payload)
        )


@router.get("", response_model=list[PageOut])
def list_pages(
    db: Session = Depends(get_db),
    _admin=Depends(require_role(AdminRole.admin, AdminRole.editor, AdminRole.viewer)),
):
    pages = db.query(Page).options(joinedload(Page.blocks)).all()
    return [_to_out(p) for p in pages]


@router.get("/{page_id}", response_model=PageOut)
def get_page(
    page_id: str,
    db: Session = Depends(get_db),
    _admin=Depends(require_role(AdminRole.admin, AdminRole.editor, AdminRole.viewer)),
):
    page = (
        db.query(Page)
        .options(joinedload(Page.blocks))
        .filter(Page.id == page_id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return _to_out(page)


@router.post("", response_model=PageOut, status_code=status.HTTP_201_CREATED)
def create_page(
    payload: PageInput,
    db: Session = Depends(get_db),
    _admin=Depends(require_role(AdminRole.admin, AdminRole.editor)),
):
    page = Page()
    _apply_input(page, payload, db)
    db.add(page)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.put("/{page_id}", response_model=PageOut)
def update_page(
    page_id: str,
    payload: PageInput,
    db: Session = Depends(get_db),
    _admin=Depends(require_role(AdminRole.admin, AdminRole.editor)),
):
    page = db.query(Page).options(joinedload(Page.blocks)).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    _apply_input(page, payload, db)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page(
    page_id: str,
    db: Session = Depends(get_db),
    _admin=Depends(require_role(AdminRole.admin, AdminRole.editor)),
):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    db.delete(page)
    db.commit()


# ---- Public read, by slug, used by about.vision-mission.tsx's usePage() ----
@public_router.get("/{slug:path}", response_model=PageOut)
def get_public_page(slug: str, db: Session = Depends(get_db)):
    page = (
        db.query(Page)
        .options(joinedload(Page.blocks))
        .filter(Page.slug == slug, Page.status == "published")
        .first()
    )
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return _to_out(page)