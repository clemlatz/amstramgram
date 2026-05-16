import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..config import DB_PATH, STORAGE_BASE
from ..db import delete_setting, get_setting, set_setting
from ..loader import get_loader, reload_session
from ..saved import sync_saved_posts
from ..scheduler import get_scheduler_status, start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)
router = APIRouter()

_bg_tasks: set[asyncio.Task] = set()
_sync_saved_lock = asyncio.Lock()


class _SessionBody(BaseModel):
    session_id: str


class _UserAgentBody(BaseModel):
    user_agent: str


@router.get("/settings")
async def get_settings():
    username = get_setting("username", DB_PATH)
    session_id = get_setting("session_id", DB_PATH)
    user_agent = get_setting("user_agent", DB_PATH)
    status = get_scheduler_status()
    return JSONResponse({
        "username": username,
        "session_id": session_id,
        "user_agent": user_agent,
        "scheduler_running": status["running"],
        "next_run_at": status["next_run_at"],
    })


@router.post("/settings/session")
async def update_session(body: _SessionBody):
    try:
        username = await asyncio.to_thread(reload_session, body.session_id)
        return JSONResponse({"username": username})
    except ValueError:
        return JSONResponse({"detail": "Authentication failed"}, status_code=401)


@router.post("/settings/user-agent")
async def update_user_agent(body: _UserAgentBody):
    if body.user_agent.strip():
        set_setting("user_agent", body.user_agent.strip(), DB_PATH)
    else:
        delete_setting("user_agent", DB_PATH)
    return JSONResponse({"ok": True})


@router.post("/settings/scheduler/start")
async def start_scheduler_endpoint():
    await start_scheduler()
    return JSONResponse({"running": True})


@router.post("/settings/scheduler/stop")
async def stop_scheduler_endpoint():
    await stop_scheduler()
    return JSONResponse({"running": False})


@router.post("/settings/sync-saved")
async def sync_saved_posts_endpoint():
    from .accounts import download_profile_pics_by_id
    if _sync_saved_lock.locked():
        return JSONResponse({"detail": "Sync already in progress"}, status_code=409)
    L = get_loader()
    if L is None:
        return JSONResponse({"detail": "No session configured"}, status_code=400)
    async with _sync_saved_lock:
        try:
            downloaded, new_ids = await asyncio.to_thread(sync_saved_posts, L, DB_PATH, STORAGE_BASE)
        except Exception as exc:
            logger.exception("sync-saved failed: %s", exc)
            return JSONResponse({"detail": "Sync failed. Please try again."}, status_code=500)
    if new_ids:
        task = asyncio.create_task(download_profile_pics_by_id(new_ids, L))
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)
    return JSONResponse({"downloaded": downloaded})
