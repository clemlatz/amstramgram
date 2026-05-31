import asyncio
import base64
import logging
import random
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from ..config import DB_PATH, MEDIA_BASE, STORAGE_BASE
from ..db import (
    archive_account,
    get_account_detail,
    get_account_posts,
    get_account_preview_media,
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
    get_all_accounts,
    save_account_profile_pic,
    set_account_active,
    set_account_hidden,
    upsert_following_accounts,
)
from ..loader import get_loader

logger = logging.getLogger(__name__)


async def sync_profile_pics_by_id(platform_user_ids: list[str], L) -> None:
    for platform_user_id in platform_user_ids:
        try:
            user_info = await asyncio.to_thread(
                L.context.get_iphone_json,
                f"api/v1/users/{platform_user_id}/info/",
                {},
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
            dest = MEDIA_BASE / platform_user_id
            dest.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread((dest / "profile.jpg").write_bytes, resp.content)
            save_account_profile_pic(
                platform_user_id, f"media/{platform_user_id}/profile.jpg", DB_PATH
            )
            logger.info("Synced profile pic for @%s", username)
        except Exception as exc:
            logger.error("profile_pic: failed for %s — %s", platform_user_id, exc)
        await asyncio.sleep(random.uniform(1, 2))


async def _sync_profile_pics_bg(candidates: list[dict], L) -> None:
    for account in candidates:
        username = account["username"]
        platform_user_id = account["platform_user_id"]
        profile_pic_url = account.get("profile_pic_url", "")
        if not profile_pic_url:
            continue
        logger.info("profile_pic: syncing for %s", username)
        try:
            # L.context._session is a requests.Session (Instaloader internal API)
            resp = await asyncio.to_thread(
                L.context._session.get, profile_pic_url, timeout=15
            )
            resp.raise_for_status()
            dest = MEDIA_BASE / platform_user_id
            dest.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread((dest / "profile.jpg").write_bytes, resp.content)
            save_account_profile_pic(
                platform_user_id, f"media/{platform_user_id}/profile.jpg", DB_PATH
            )
            logger.info("Synced profile pic for @%s", username)
        except Exception as exc:
            logger.error("profile_pic: failed for %s — %s", username, exc)
        await asyncio.sleep(random.uniform(1, 2))


def _encode(filepath: str) -> str:
    return base64.urlsafe_b64encode(filepath.encode()).decode().rstrip("=")


def _media_type(ext: str) -> str:
    return "video" if ext == "mp4" else "image"


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
        added, candidates = await asyncio.to_thread(
            _fetch_and_upsert_following, L, DB_PATH
        )
    except Exception as exc:
        logger.exception("sync-following failed: %s", exc)
        return JSONResponse(
            {"detail": "Sync failed. Please try again."}, status_code=500
        )
    if candidates:
        task = asyncio.create_task(_sync_profile_pics_bg(candidates, L))
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)
    return JSONResponse({"added": added})


@router.get("/accounts/{username}/avatar")
async def get_account_avatar_route(username: str):
    profile_pic_path = await asyncio.to_thread(
        get_account_profile_pic_path, username, DB_PATH
    )
    if not profile_pic_path:
        raise HTTPException(status_code=404, detail="Avatar not found")
    full_path = (STORAGE_BASE / profile_pic_path).resolve()
    if not full_path.is_relative_to(STORAGE_BASE.resolve()):
        raise HTTPException(status_code=404, detail="Avatar not found")
    if not await asyncio.to_thread(full_path.exists):
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(
        str(full_path),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


class AccountPatch(BaseModel):
    active: bool | None = None
    hidden: bool | None = None


@router.patch("/accounts/{username}")
async def patch_account_route(username: str, body: AccountPatch):
    if body.hidden is not None:
        updated = await asyncio.to_thread(
            set_account_hidden, username, body.hidden, DB_PATH
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Account not found")
        detail = await asyncio.to_thread(get_account_detail, username, DB_PATH)
        return JSONResponse({"active": detail["active"], "hidden": detail["hidden"]})
    if body.active is not None:
        updated = await asyncio.to_thread(
            set_account_active, username, body.active, DB_PATH
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Account not found")
        return JSONResponse({"active": body.active})
    raise HTTPException(status_code=422, detail="No field to update")


@router.post("/accounts/{username}/archive")
async def archive_account_route(username: str):
    archived = await asyncio.to_thread(archive_account, username, DB_PATH)
    if not archived:
        raise HTTPException(status_code=404, detail="Account not found")
    return JSONResponse({"archived": True})


@router.get("/accounts/{username}")
async def get_account_detail_route(username: str):
    detail = await asyncio.to_thread(get_account_detail, username, DB_PATH)
    if detail is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return JSONResponse(detail)


@router.get("/accounts/{username}/posts")
async def get_account_posts_route(username: str):
    posts = await asyncio.to_thread(get_account_posts, username, DB_PATH)
    return JSONResponse(
        {
            "posts": [
                {
                    "account": p["account"],
                    "account_active": p["account_active"],
                    "caption": p["caption"],
                    "post_timestamp": p["post_timestamp"],
                    "shortcode": p["shortcode"],
                    "archived_at": p["archived_at"],
                    "favorited_at": p["favorited_at"],
                    "media": [
                        {
                            "url": f"/api/media/{_encode(fp)}",
                            "type": _media_type(ext),
                            "width": w,
                            "height": h,
                        }
                        for fp, ext, w, h in p["media"]
                    ],
                }
                for p in posts
            ]
        }
    )


@router.get("/accounts/{username}/preview")
async def get_account_preview_route(username: str):
    detail = await asyncio.to_thread(get_account_detail, username, DB_PATH)
    if detail is None:
        raise HTTPException(status_code=404, detail="Account not found")
    items = await asyncio.to_thread(get_account_preview_media, username, 5, DB_PATH)
    return JSONResponse({
        "media": [
            {
                "url": f"/api/media/{_encode(item['filepath'])}",
                "type": _media_type(item["extension"]),
                "shortcode": item["shortcode"],
            }
            for item in items
        ]
    })


def _fetch_and_upsert_following(L, db_path: Path) -> tuple[int, list[dict]]:
    logger.info("sync-following: fetching following list")
    user_info = L.context.get_iphone_json(
        "api/v1/accounts/current_user/", {"edit": "false"}
    )
    user_id = user_info["user"]["pk"]

    accounts = []
    params: dict = {"count": 200}
    while True:
        data = L.context.get_iphone_json(
            f"api/v1/friendships/{user_id}/following/", params
        )
        for user in data.get("users", []):
            accounts.append(
                {
                    "username": user["username"],
                    "platform_user_id": str(user["pk"]),
                    "profile_pic_url": user.get("profile_pic_url", ""),
                    "bio": user.get("biography") or "",
                    "full_name": user.get("full_name") or "",
                    "external_url": user.get("external_url") or "",
                }
            )
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
