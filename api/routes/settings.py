import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..config import DB_PATH, STORAGE_BASE
from ..db import delete_setting, get_setting, set_setting
from ..importer import count_pending_imports, import_from_disk_lock, run_import as run_import_media
from ..loader import get_loader, reload_session
from ..logs import get_logs
from ..saved import sync_saved_posts
from ..scheduler import (
    RateLimitException,
    SESSION_INVALIDATED_EXCEPTIONS,
    get_scheduler_status,
    run_manual_cycle,
    start_scheduler,
    stop_scheduler,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_bg_tasks: set[asyncio.Task] = set()
_import_saved_lock = asyncio.Lock()


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
    return JSONResponse(
        {
            "username": username,
            "session_id": session_id,
            "user_agent": user_agent,
            "scheduler_running": status["running"],
            "cycle_running": status["cycle_running"],
            "next_run_at": status["next_run_at"],
            "pending_imports": count_pending_imports(STORAGE_BASE),
        }
    )


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


@router.post("/settings/import-now")
async def import_now_endpoint():
    try:
        account_counts = await run_manual_cycle()
    except RuntimeError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=409)
    except RateLimitException as exc:
        logger.warning("manual import cycle rate limited: %s", exc)
        return JSONResponse(
            {"detail": "Rate limited by Instagram. Please wait a few minutes."},
            status_code=429,
        )
    except SESSION_INVALIDATED_EXCEPTIONS:
        return JSONResponse(
            {"detail": "Session invalidated. Update the session ID above."},
            status_code=401,
        )
    except Exception as exc:
        logger.exception("manual import cycle failed: %s", exc)
        return JSONResponse({"detail": "Import failed. Please try again."}, status_code=500)
    total = sum(account_counts.values())
    return JSONResponse({"imported": total, "accounts": account_counts})


@router.get("/logs")
async def get_logs_endpoint():
    return JSONResponse({"logs": get_logs()})


@router.post("/settings/import-saved")
async def import_saved_posts_endpoint():
    from .accounts import sync_profile_pics_by_id

    if _import_saved_lock.locked():
        return JSONResponse({"detail": "Import already in progress"}, status_code=409)
    L = get_loader()
    if L is None:
        return JSONResponse({"detail": "No session configured"}, status_code=400)
    async with _import_saved_lock:
        try:
            imported, new_ids = await asyncio.to_thread(
                sync_saved_posts, L, DB_PATH, STORAGE_BASE
            )
        except RateLimitException as exc:
            logger.warning("import-saved: rate limited — %s", exc)
            return JSONResponse({"detail": "Rate limited by Instagram. Please wait a few minutes."}, status_code=429)
        except Exception as exc:
            logger.exception("import-saved failed: %s", exc)
            return JSONResponse(
                {"detail": "Import failed. Please try again."}, status_code=500
            )
    if new_ids:
        task = asyncio.create_task(sync_profile_pics_by_id(new_ids, L))
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)
    return JSONResponse({"imported": imported})


@router.post("/settings/import-from-disk")
async def import_from_disk_endpoint():
    if import_from_disk_lock.locked():
        return JSONResponse({"detail": "Import already in progress."}, status_code=409)
    async with import_from_disk_lock:
        try:
            result = await asyncio.to_thread(run_import_media, DB_PATH, STORAGE_BASE)
        except Exception as exc:
            logger.exception("manual import from disk failed: %s", exc)
            return JSONResponse({"detail": "Import failed. Please try again."}, status_code=500)
    return JSONResponse(result)
