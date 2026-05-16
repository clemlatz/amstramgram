import asyncio
import base64

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_random_neutral_photo

router = APIRouter()


def _encode(filepath: str) -> str:
    return base64.urlsafe_b64encode(filepath.encode()).decode().rstrip("=")


def _media_type(ext: str) -> str:
    return "video" if ext == "mp4" else "image"


@router.get("/random")
async def get_random():
    photo = await asyncio.to_thread(get_random_neutral_photo, DB_PATH)
    if not photo:
        return JSONResponse({"photo": None})
    return JSONResponse({
        "photo": {
            "account": photo["account"],
            "post_timestamp": photo["post_timestamp"],
            "shortcode": photo["shortcode"],
            "media": [
                {"url": f"/api/media/{_encode(fp)}", "type": _media_type(ext)}
                for fp, ext in photo["media"]
            ],
        }
    })
