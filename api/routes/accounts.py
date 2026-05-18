import asyncio
import logging
import random
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from ..config import DB_PATH, STORAGE_BASE
from ..db import (
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
    get_all_accounts,
    save_account_profile_pic,
    upsert_following_accounts,
)
from ..loader import get_loader

logger = logging.getLogger(__name__)


async def download_profile_pics_by_id(platform_user_ids: list[str], L) -> None:
    for platform_user_id in platform_user_ids:
        try:
            user_info = await asyncio.to_thread(
                L.context.get_iphone_json,
                f"api/v1/users/{platform_user_id}/info/", {},
            )
            user = user_info["user"]
            profile_pic_url = user.get("profile_pic_url", "")
            username = user.get("username", platform_user_id)
            if not profile_pic_url:
                continue
            resp = await asyncio.to_thread(
                L.context._session.get, profile_pic_url, timeout=15
            )
            resp.raise_for_status()
            dest = STORAGE_BASE / platform_user_id
            dest.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread((dest / "profile.jpg").write_bytes, resp.content)
            save_account_profile_pic(platform_user_id, f"{platform_user_id}/profile.jpg", DB_PATH)
            logger.info("Downloaded profile pic for @%s", username)
        except Exception as exc:
            logger.error("profile_pic: failed for %s — %s", platform_user_id, exc)
        await asyncio.sleep(random.uniform(1, 2))


async def _download_profile_pics_bg(candidates: list[dict], L) -> None:
    for account in candidates:
        username = account["username"]
        platform_user_id = account["platform_user_id"]
        profile_pic_url = account.get("profile_pic_url", "")
        if not profile_pic_url:
            continue
        logger.info("profile_pic: downloading for %s", username)
        try:
            # L.context._session is a requests.Session (Instaloader internal API)
            resp = await asyncio.to_thread(
                L.context._session.get, profile_pic_url, timeout=15
            )
            resp.raise_for_status()
            dest = STORAGE_BASE / platform_user_id
            dest.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread((dest / "profile.jpg").write_bytes, resp.content)
            save_account_profile_pic(platform_user_id, f"{platform_user_id}/profile.jpg", DB_PATH)
            logger.info("Downloaded profile pic for @%s", username)
        except Exception as exc:
            logger.error("profile_pic: failed for %s — %s", username, exc)
        await asyncio.sleep(random.uniform(1, 2))


router = APIRouter()

_bg_tasks: set[asyncio.Task] = set()


@router.get("/accounts")
async def get_accounts_route():
    accounts = await asyncio.to_thread(get_all_accounts, DB_PATH)
    return JSONResponse(accounts)


@router.post("/accounts/sync-following")
async def sync_following_route():
    L = get_loader()
    if L is None:
        return JSONResponse({"detail": "No session configured"}, status_code=400)
    try:
        added, candidates = await asyncio.to_thread(_fetch_and_upsert_following, L, DB_PATH)
    except Exception as exc:
        logger.exception("sync-following failed: %s", exc)
        return JSONResponse({"detail": "Sync failed. Please try again."}, status_code=500)
    if candidates:
        task = asyncio.create_task(_download_profile_pics_bg(candidates, L))
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)
    return JSONResponse({"added": added})


@router.get("/accounts/{username}/avatar")
async def get_account_avatar_route(username: str):
    profile_pic_path = await asyncio.to_thread(get_account_profile_pic_path, username, DB_PATH)
    if not profile_pic_path:
        raise HTTPException(status_code=404, detail="Avatar not found")
    full_path = (STORAGE_BASE / profile_pic_path).resolve()
    if not full_path.is_relative_to(STORAGE_BASE.resolve()):
        raise HTTPException(status_code=404, detail="Avatar not found")
    if not await asyncio.to_thread(full_path.exists):
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(str(full_path), media_type="image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400"})


def _fetch_and_upsert_following(L, db_path: Path) -> tuple[int, list[dict]]:
    logger.info("sync-following: fetching following list")
    user_info = L.context.get_iphone_json("api/v1/accounts/current_user/", {"edit": "false"})
    user_id = user_info["user"]["pk"]

    accounts = []
    params: dict = {"count": 200}
    while True:
        data = L.context.get_iphone_json(f"api/v1/friendships/{user_id}/following/", params)
        for user in data.get("users", []):
            accounts.append({
                "username": user["username"],
                "platform_user_id": str(user["pk"]),
                "profile_pic_url": user.get("profile_pic_url", ""),
            })
        next_cursor = data.get("next_max_id")
        if not next_cursor:
            break
        params = {"count": 200, "max_id": next_cursor}

    logger.info("sync-following: %d account(s) found in following list", len(accounts))
    added, new_usernames = upsert_following_accounts(accounts, db_path)
    for uname in new_usernames:
        logger.info("Added account @%s", uname)
    logger.info("sync-following: done — %d new account(s) added", added)

    missing_ids = get_accounts_missing_profile_pic(
        [a["platform_user_id"] for a in accounts], db_path
    )
    candidates = [a for a in accounts if a["platform_user_id"] in missing_ids]
    return added, candidates
