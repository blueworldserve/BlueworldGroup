from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from core.audit import CRITICAL, record
from core.deps import get_db
from core.limiter import limiter
from core.permissions import require_superuser
from schemas.base import CamelModel

router = APIRouter(prefix="/admin/system", tags=["admin-system"])

RESET_PHRASE = "I want to reset the content"


class ResetContentIn(CamelModel):
    confirmation: str


@router.post("/reset-content")
@limiter.limit("3/minute")
def reset_content(request: Request, payload: ResetContentIn, db: Session = Depends(get_db), user=Depends(require_superuser)):
    if payload.confirmation.strip() != RESET_PHRASE:
        raise HTTPException(400, "Confirmation phrase does not match")
    record(db, request, user, category=CRITICAL, action="content_reset", resource="site",
           summary="Superuser confirmed 'Reset content'")
    db.commit()
    return {"ok": True}