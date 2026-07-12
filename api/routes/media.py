import base64
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
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

_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


@router.get("/media/{encoded}")
def get_media(encoded: str, request: Request):
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

    file_size = resolved.stat().st_size
    range_header = request.headers.get("range")
    match = _RANGE_RE.fullmatch(range_header) if range_header else None

    if not match:
        return Response(
            content=resolved.read_bytes(),
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=86400", "Accept-Ranges": "bytes"},
        )

    start_str, end_str = match.groups()
    start = int(start_str) if start_str else 0
    end = int(end_str) if end_str else file_size - 1
    end = min(end, file_size - 1)

    with resolved.open("rb") as f:
        f.seek(start)
        chunk = f.read(end - start + 1)

    return Response(
        content=chunk,
        status_code=206,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(len(chunk)),
        },
    )
