import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import DB_PATH
from ..db import upsert_rating

router = APIRouter()

_VALID_ACTIONS = {"archive", "favorite", "clear"}


class RateBody(BaseModel):
    shortcode: str
    action: str


@router.post("/rate")
async def post_rate(body: RateBody):
    if not body.shortcode:
        raise HTTPException(400, "shortcode required")
    if body.action not in _VALID_ACTIONS:
        raise HTTPException(400, "invalid action")
    await asyncio.to_thread(upsert_rating, body.shortcode, body.action, DB_PATH)
    return {"ok": True}
