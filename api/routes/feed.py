import asyncio
import base64

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_recent_posts

router = APIRouter()


def _encode(filepath: str) -> str:
    return base64.urlsafe_b64encode(filepath.encode()).decode().rstrip("=")


def _media_type(ext: str) -> str:
    return "video" if ext == "mp4" else "image"


@router.get("/feed")
async def get_feed():
    posts = await asyncio.to_thread(get_recent_posts, DB_PATH)
    return JSONResponse({
        "posts": [
            {
                "account": p["account"],
                "caption": p["caption"],
                "post_timestamp": p["post_timestamp"],
                "shortcode": p["shortcode"],
                "archived_at": p["archived_at"],
                "favorited_at": p["favorited_at"],
                "media": [
                    {"url": f"/api/media/{_encode(fp)}", "type": _media_type(ext), "width": w, "height": h}
                    for fp, ext, w, h in p["media"]
                ],
            }
            for p in posts
        ]
    })
