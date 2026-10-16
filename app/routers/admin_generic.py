import uuid
from typing import Type

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.audit import ACTIVITY, diff, label, record, snapshot
from core.deps import get_db
from core.permissions import require_read, require_write
from models.admin_user import AdminUser


def make_admin_crud_router(
    resource: str,
    model,
    schema_out: Type[BaseModel],
    schema_create: Type[BaseModel],
) -> APIRouter:
    router = APIRouter(prefix=f"/admin/{resource}", tags=[f"admin-{resource}"])
    write = require_write(resource)
    fields = list(schema_create.model_fields)

    @router.get("", response_model=list[schema_out])
    def list_items(
        db: Session = Depends(get_db),
        _=Depends(require_read),
    ):
        return db.query(model).all()

    @router.post("", response_model=schema_out, status_code=201)
    def create_item(
        request: Request,
        payload: schema_create,
        db: Session = Depends(get_db),
        user: AdminUser = Depends(write),
    ):
        item = model(**payload.model_dump())
        db.add(item)
        db.flush()
        record(db, request, user, category=ACTIVITY, action="create", resource=resource, resource_id=item.id,
               summary=f"{user.email} created {resource} “{label(item)}”")
        db.commit()
        db.refresh(item)
        return item

    @router.put("/{item_id}", response_model=schema_out)
    def update_item(
        request: Request,
        item_id: uuid.UUID,
        payload: schema_create,
        db: Session = Depends(get_db),
        user: AdminUser = Depends(write),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(404, f"{resource} not found")
        before = snapshot(item, fields)
        for field, value in payload.model_dump().items():
            setattr(item, field, value)
        changes = diff(before, snapshot(item, fields))
        if changes:
            record(db, request, user, category=ACTIVITY, action="update", resource=resource, resource_id=item.id,
                   summary=f"{user.email} edited {resource} “{label(item)}” ({', '.join(changes)})",
                   details={"changes": changes})
        db.commit()
        db.refresh(item)
        return item

    @router.delete("/{item_id}", status_code=204)
    def delete_item(
        request: Request,
        item_id: uuid.UUID,
        db: Session = Depends(get_db),
        user: AdminUser = Depends(write),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(404, f"{resource} not found")
        record(db, request, user, category=ACTIVITY, action="delete", resource=resource, resource_id=item.id,
               summary=f"{user.email} deleted {resource} “{label(item)}”",
               details={"deleted": snapshot(item, fields)})
        db.delete(item)
        db.commit()

    return router