import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_account_posts, get_all_shortcodes_set
from .accounts import serialize_account_posts

router = APIRouter()


@router.get("/shortcodes")
async def get_shortcodes():
    shortcodes = await asyncio.to_thread(get_all_shortcodes_set, DB_PATH)
    return JSONResponse(sorted(shortcodes))


@router.get("/accounts/{username}/posts")
async def get_account_posts_route(username: str):
    posts = await asyncio.to_thread(get_account_posts, username, DB_PATH)
    return JSONResponse(serialize_account_posts(posts))
