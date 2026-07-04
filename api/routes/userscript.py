import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH, STORAGE_BASE
from ..db import get_account_posts, get_all_shortcodes_set
from ..importer import import_from_disk_lock, run_import
from .accounts import serialize_account_posts

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/shortcodes")
async def get_shortcodes():
    shortcodes = await asyncio.to_thread(get_all_shortcodes_set, DB_PATH)
    return JSONResponse(sorted(shortcodes))


@router.get("/accounts/{username}/posts")
async def get_account_posts_route(username: str):
    posts = await asyncio.to_thread(get_account_posts, username, DB_PATH)
    return JSONResponse(serialize_account_posts(posts))


@router.post("/import-from-disk")
async def import_from_disk_route():
    """Run the Gramoire disk import, triggered automatically by the userscript after a
    successful download. Shares ``import_from_disk_lock`` with the manual settings route
    so only one import runs at a time."""
    if import_from_disk_lock.locked():
        return JSONResponse({"detail": "Import already in progress."}, status_code=409)
    async with import_from_disk_lock:
        try:
            result = await asyncio.to_thread(run_import, DB_PATH, STORAGE_BASE)
        except Exception as exc:
            logger.exception("userscript import from disk failed: %s", exc)
            return JSONResponse({"detail": "Import failed. Please try again."}, status_code=500)
    return JSONResponse(result)
