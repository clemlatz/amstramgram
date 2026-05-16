import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH, STORAGE_BASE
from ..db import get_stats

router = APIRouter()


@router.get("/stats")
async def get_stats_route():
    stats = await asyncio.to_thread(get_stats, DB_PATH, STORAGE_BASE)
    return JSONResponse(stats)
