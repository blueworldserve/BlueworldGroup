import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from core.audit import ACTIVITY, diff, label, record, snapshot
from core.deps import get_db
from core.permissions import require_admin, require_read, require_write
from models.admin_user import AdminUser
from models.business_unit import BusinessUnit, BusinessSubLine
from schemas.business_unit import BusinessUnitOut, BusinessUnitCreate

router = APIRouter(prefix="/admin/business-units", tags=["admin-business-units"])


@router.get("", response_model=list[BusinessUnitOut])
def list_business_units(
    db: Session = Depends(get_db),
    _=Depends(require_read),
):
    return db.query(BusinessUnit).options(joinedload(BusinessUnit.sub_lines)).all()


@router.post("", response_model=BusinessUnitOut, status_code=201)
def create_business_unit(
    request: Request,
    payload: BusinessUnitCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_write("business-units")),
):
    unit = BusinessUnit(**payload.model_dump(exclude={"sub_lines"}))
    for sl in payload.sub_lines:
        unit.sub_lines.append(BusinessSubLine(**sl.model_dump()))
    db.add(unit)
    db.flush()
    record(db, request, user, category=ACTIVITY, action="create", resource="business-units", resource_id=unit.id,
           summary=f"{user.email} created business unit “{label(unit)}”")
    db.commit()
    db.refresh(unit)
    return unit


@router.put("/{unit_id}", response_model=BusinessUnitOut)
def update_business_unit(
    request: Request,
    unit_id: uuid.UUID,
    payload: BusinessUnitCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_write("business-units")),
):
    unit = db.query(BusinessUnit).filter(BusinessUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(404, "Business unit not found")
    fields = list(payload.model_dump(exclude={"sub_lines"}))
    before = snapshot(unit, fields)
    sub_lines_before = len(unit.sub_lines)
    for field, value in payload.model_dump(exclude={"sub_lines"}).items():
        setattr(unit, field, value)
    unit.sub_lines.clear()
    for sl in payload.sub_lines:
        unit.sub_lines.append(BusinessSubLine(**sl.model_dump()))
    changes = diff(before, snapshot(unit, fields))
    record(db, request, user, category=ACTIVITY, action="update", resource="business-units", resource_id=unit.id,
           summary=f"{user.email} edited business unit “{label(unit)}” ({', '.join(changes) or 'sub-lines'})",
           details={"changes": changes, "sub_lines": {"from": sub_lines_before, "to": len(payload.sub_lines)}})
    db.commit()
    db.refresh(unit)
    return unit


@router.delete("/{unit_id}", status_code=204)
def delete_business_unit(
    request: Request,
    unit_id: uuid.UUID,
    db: Session = Depends(get_db),
    # Deleting a whole business unit is admin/superuser only.
    user: AdminUser = Depends(require_admin),
):
    unit = db.query(BusinessUnit).filter(BusinessUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(404, "Business unit not found")
    record(db, request, user, category=ACTIVITY, action="delete", resource="business-units", resource_id=unit.id,
           summary=f"{user.email} deleted business unit “{label(unit)}”")
    db.delete(unit)
    db.commit()