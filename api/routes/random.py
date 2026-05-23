import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_random_neutral_post, get_random_favorite_post, get_all_favorite_media_filepaths
from .feed import _encode, _media_type

router = APIRouter()


@router.get("/random")
async def get_random():
    post = await asyncio.to_thread(get_random_neutral_post, DB_PATH)
    if not post:
        return JSONResponse({"post": None})
    return JSONResponse(
        {
            "post": {
                "account": post["account"],
                "post_timestamp": post["post_timestamp"],
                "shortcode": post["shortcode"],
                "media": [
                    {
                        "url": f"/api/media/{_encode(fp)}",
                        "type": _media_type(ext),
                        "width": w,
                        "height": h,
                    }
                    for fp, ext, w, h in post["media"]
                ],
            }
        }
    )


@router.get("/random/favorites")
async def get_random_favorites():
    post = await asyncio.to_thread(get_random_favorite_post, DB_PATH)
    if not post:
        return JSONResponse({"post": None})
    return JSONResponse(
        {
            "post": {
                "account": post["account"],
                "post_timestamp": post["post_timestamp"],
                "shortcode": post["shortcode"],
                "media": [
                    {
                        "url": f"/api/media/{_encode(fp)}",
                        "type": _media_type(ext),
                        "width": w,
                        "height": h,
                    }
                    for fp, ext, w, h in post["media"]
                ],
            }
        }
    )


@router.get("/favorites/media-urls")
async def get_favorites_media_urls():
    filepaths = await asyncio.to_thread(get_all_favorite_media_filepaths, DB_PATH)
    urls = [f"/api/media/{_encode(fp)}" for fp in filepaths]
    return JSONResponse({"urls": urls, "total": len(urls)})
