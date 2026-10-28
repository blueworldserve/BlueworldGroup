"""Endpoints for outside schedulers (cron-job.org, Railway cron, ...). Disabled unless CRON_SECRET is set."""
import hmac

from fastapi import APIRouter, Header, HTTPException, status

from core import config
from core.notify import send_application_digest

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


@router.post("/applications-digest")
def applications_digest(x_cron_secret: str | None = Header(None)):
    if not config.CRON_SECRET:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, config.CRON_SECRET):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    return {"announced": send_application_digest()}