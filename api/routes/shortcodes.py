import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_all_shortcodes_set

router = APIRouter()


@router.get("/shortcodes")
async def get_shortcodes():
    shortcodes = await asyncio.to_thread(get_all_shortcodes_set, DB_PATH)
    return JSONResponse(sorted(shortcodes))
