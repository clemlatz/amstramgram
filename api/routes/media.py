import base64
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..config import STORAGE_BASE

router = APIRouter()

_CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "png": "image/png",
    "mp4": "video/mp4",
}


@router.get("/media/{encoded}")
def get_media(encoded: str):
    try:
        padded = encoded + "=" * (-len(encoded) % 4)
        filepath = Path(base64.urlsafe_b64decode(padded).decode())
    except Exception:
        raise HTTPException(404)

    resolved = (STORAGE_BASE / filepath).resolve()
    if not resolved.is_relative_to(STORAGE_BASE.resolve()):
        raise HTTPException(404)
    if not resolved.exists():
        raise HTTPException(404)

    content_type = _CONTENT_TYPES.get(resolved.suffix[1:].lower())
    if not content_type:
        raise HTTPException(404)

    return Response(
        content=resolved.read_bytes(),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
