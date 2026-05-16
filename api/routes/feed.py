import asyncio
import base64

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_recent_photos

router = APIRouter()


def _encode(filepath: str) -> str:
    return base64.urlsafe_b64encode(filepath.encode()).decode().rstrip("=")


@router.get("/feed")
async def get_feed():
    photos = await asyncio.to_thread(get_recent_photos, DB_PATH)
    return JSONResponse({
        "photos": [
            {
                "account": p["account"],
                "caption": p["caption"],
                "post_timestamp": p["post_timestamp"],
                "shortcode": p["shortcode"],
                "archived_at": p["archived_at"],
                "favorited_at": p["favorited_at"],
                "images": [f"/api/image/{_encode(fp)}" for fp in p["filepaths"]],
            }
            for p in photos
        ]
    })
