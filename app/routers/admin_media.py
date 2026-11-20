import io
import uuid
from urllib.parse import urlparse

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from PIL import Image
from sqlalchemy.orm import Session

from core import config
from core.audit import ACTIVITY, label, record
from core.deps import get_db
from core.permissions import require_read, require_write
from models.admin_user import AdminUser
from models.media_asset import MediaAsset
from schemas.media import MediaAssetOut, MediaAssetUpdate, MediaAssetCreate

cloudinary.config(
    cloud_name=config.CLOUDINARY_CLOUD_NAME,
    api_key=config.CLOUDINARY_API_KEY,
    api_secret=config.CLOUDINARY_API_SECRET,
)

router = APIRouter(prefix="/admin/media", tags=["admin-media"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # Cloudinary's plan limit
MAX_RAW_UPLOAD_BYTES = 25 * 1024 * 1024  # what we accept BEFORE compressing
MAX_DIMENSION = 2400  # longest edge, in pixels — plenty sharp for web use
# Refuse "decompression bomb" images (a tiny file that expands to gigabytes of pixels in memory).
Image.MAX_IMAGE_PIXELS = 60_000_000


def compress_image(raw: bytes) -> tuple[bytes, str]:
    """
    Resizes and re-encodes an image so it comfortably clears Cloudinary's
    upload size limit, without a visible quality loss for web display.
    Returns (compressed_bytes, content_type).
    """
    img = Image.open(io.BytesIO(raw))
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)

    # Shrink only if it's actually larger than our target — never upscale.
    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    buffer = io.BytesIO()
    if has_alpha:
        img = img.convert("RGBA")
        img.save(buffer, format="PNG", optimize=True)
        content_type = "image/png"
    else:
        img = img.convert("RGB")
        # Step the JPEG quality down only as far as needed to clear the limit —
        # starts high (92) so most images need no further reduction at all.
        quality = 92
        while True:
            buffer.seek(0)
            buffer.truncate()
            img.save(buffer, format="JPEG", quality=quality, optimize=True)
            if buffer.tell() <= MAX_UPLOAD_BYTES or quality <= 40:
                break
            quality -= 8
        content_type = "image/jpeg"

    return buffer.getvalue(), content_type


def _is_safe_image_url(url: str) -> bool:
    """https only, and none of the characters that could break out of an HTML attribute or a CSS url(...)."""
    parsed = urlparse(url or "")
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    return not any(ch in url for ch in "\"'()<>\\ \t\r\n")


@router.get("", response_model=list[MediaAssetOut])
def list_media(
    db: Session = Depends(get_db),
    _=Depends(require_read),
):
    return db.query(MediaAsset).all()


@router.post("/upload", response_model=MediaAssetOut, status_code=201)
def upload_media(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_write("media-upload")),
):
    raw = file.file.read(MAX_RAW_UPLOAD_BYTES + 1)
    if len(raw) > MAX_RAW_UPLOAD_BYTES:
        raise HTTPException(413, "That image is larger than 25 MB. Please upload a smaller photo.")
    try:
        compressed, _content_type = compress_image(raw)
    except Exception:
        raise HTTPException(400, "Could not process this image — please upload a valid JPEG, PNG or WebP file.")

    if len(compressed) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            413,
            "This image is too large even after compression. Please upload a smaller photo.",
        )

    result = cloudinary.uploader.upload(
        io.BytesIO(compressed),
        folder=config.CLOUDINARY_UPLOAD_FOLDER,
    )
    asset = MediaAsset(
        filename=file.filename,
        url=result["secure_url"],
        width=result.get("width", 0),
        height=result.get("height", 0),
        used_on="",
    )
    db.add(asset)
    db.flush()
    record(db, request, user, category=ACTIVITY, action="upload", resource="media", resource_id=asset.id,
           summary=f"{user.email} uploaded image “{asset.filename}”")
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/{asset_id}", response_model=MediaAssetOut)
def update_media(
    request: Request,
    asset_id: uuid.UUID,
    payload: MediaAssetUpdate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_write("media")),
):
    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Media asset not found")
    if payload.filename is not None:
        asset.filename = payload.filename
    if payload.used_on is not None:
        asset.used_on = payload.used_on
    record(db, request, user, category=ACTIVITY, action="update", resource="media", resource_id=asset.id,
           summary=f"{user.email} edited media “{label(asset)}”")
    db.commit()
    db.refresh(asset)
    return asset

@router.delete("/{asset_id}", status_code=204)
def delete_media(
    request: Request,
    asset_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_write("media")),
):
    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Media asset not found")
    record(db, request, user, category=ACTIVITY, action="delete", resource="media", resource_id=asset.id,
           summary=f"{user.email} deleted media “{label(asset)}”")
    db.delete(asset)
    db.commit()




@router.post("", response_model=MediaAssetOut, status_code=201)
def register_existing_media(
    request: Request,
    payload: MediaAssetCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_write("media-upload")),
):
    """
    Registers an image that already exists at a URL (e.g. still on Cloudinary
    after its database row was deleted) — no re-upload, just a new tracking
    record. Does not verify the URL is reachable or actually an image.
    """
    if not _is_safe_image_url(payload.url):
        raise HTTPException(400, "The image address must be a plain https:// link.")
    asset = MediaAsset(
        filename=payload.filename or payload.url.rsplit("/", 1)[-1],
        url=payload.url,
        width=payload.width,
        height=payload.height,
        used_on=payload.used_on or "",
    )
    db.add(asset)
    db.flush()
    record(db, request, user, category=ACTIVITY, action="create", resource="media", resource_id=asset.id,
           summary=f"{user.email} registered existing image “{asset.filename}”")
    db.commit()
    db.refresh(asset)
    return asset




MAX_VIDEO_BYTES = 90 * 1024 * 1024  # Cloudinary free plan caps video at 100 MB; lower this if your plan differs
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov", ".m4v")


@router.post("/upload-video", status_code=201)
def upload_video(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_write("hero-slides")),
):
    # Some browsers/OSes send an empty or generic content-type for .mov/.mp4, so also accept by extension.
    name = (file.filename or "").lower()
    type_ok = file.content_type in ALLOWED_VIDEO_TYPES or (
        name.endswith(ALLOWED_VIDEO_EXTENSIONS) and (file.content_type or "") in ("", "application/octet-stream", "video/x-m4v")
    )
    if not type_ok:
        raise HTTPException(400, "Please upload an MP4, WebM or MOV video.")

    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_VIDEO_BYTES:
        raise HTTPException(
            413,
            f"This video is {size // (1024 * 1024)} MB; the limit is {MAX_VIDEO_BYTES // (1024 * 1024)} MB. "
            "Compress it, or paste a YouTube link instead.",
        )

    try:
        result = cloudinary.uploader.upload(
            file.file,
            resource_type="video",
            folder=config.CLOUDINARY_UPLOAD_FOLDER,
        )
    except Exception:
        raise HTTPException(502, "Video upload failed. Please try again.")

    record(db, request, user, category=ACTIVITY, action="upload", resource="media", summary=f"{user.email} uploaded video “{file.filename}”")
    db.commit()
    return {"url": result["secure_url"]}