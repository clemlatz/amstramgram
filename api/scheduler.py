import asyncio
import logging
import math
import random
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

import instaloader

from .config import DB_PATH, DRY_RUN, STORAGE_BASE
from .db import (
    deactivate_account,
    get_active_accounts,
    get_setting,
    get_unsynced_accounts,
    index_account,
    init_db,
    mark_account_synced,
    migrate_done_files,
    set_setting,
)
from .loader import download_lock, get_loader, persist_session_cookies

logger = logging.getLogger(__name__)


_MIN_DOWNLOADS_PER_ACCOUNT = 60
_MAX_DOWNLOADS_PER_ACCOUNT = 140
_RATE_LIMIT_BACKOFF_BASE = 1800   # 30 min
_RATE_LIMIT_BACKOFF_MAX = 10800   # 3 h
_MIN_ACCOUNTS_PER_CYCLE = 5
_MAX_ACCOUNTS_PER_CYCLE = 15

_stop_event: threading.Event = threading.Event()
_scheduler_task: asyncio.Task | None = None


def _fmt_delay(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        m, s = divmod(seconds, 60)
        return f"{m}m{s:02d}s" if s else f"{m}min"
    h, rem = divmod(seconds, 3600)
    m = rem // 60
    return f"{h}h{m:02d}min" if m else f"{h}h"


def _sleep(seconds: int, reason: str = "") -> None:
    until = datetime.now() + timedelta(seconds=seconds)
    now = datetime.now()
    until_str = until.strftime("%H:%M:%S") if until.date() == now.date() else until.strftime("%m/%d %H:%M:%S")
    label = f" ({reason})" if reason else ""
    logger.info("Waiting %s until %s%s", _fmt_delay(seconds), until_str, label)
    time.sleep(seconds)


class RateLimitException(Exception):
    pass


def _is_rate_limited(exc: Exception) -> bool:
    if isinstance(exc, instaloader.TooManyRequestsException):
        return True
    msg = str(exc)
    return ("401" in msg and "wait" in msg.lower()) or "429" in msg


def _is_not_found(exc: Exception) -> bool:
    return "404" in str(exc)


def _lognormal_delay(low: int, high: int) -> int:
    """Return a random integer delay in [low, high] with a log-normal distribution."""
    mid = (low + high) / 2
    sigma = 0.4
    mu = math.log(mid)
    return int(max(low, min(high, random.lognormvariate(mu, sigma))))


_DEFAULT_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/274.0.0.0"


def _set_session_headers(L: instaloader.Instaloader) -> None:
    ua = get_setting("user_agent", DB_PATH) or _DEFAULT_USER_AGENT
    L.context._session.headers.update({
        "X-IG-App-ID": "936619743392459",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.instagram.com/",
        "User-Agent": ua,
    })


async def _wait_until_window() -> None:
    now = datetime.now()
    if 7 <= now.hour < 23:
        return
    if now.hour < 7:
        target = now.replace(hour=7, minute=0, second=0, microsecond=0)
    else:
        target = (now + timedelta(days=1)).replace(hour=7, minute=0, second=0, microsecond=0)
    delay = (target - now).total_seconds()
    logger.info("Outside active window — sleeping until 07:00 (%.0f min)", delay / 60)
    await asyncio.sleep(delay)



def _download_account_fast(
    L: instaloader.Instaloader,
    account_id: int,
    platform_user_id: str,
    username: str,
    db_path: Path,
) -> None:
    dest = STORAGE_BASE / platform_user_id
    dest.mkdir(parents=True, exist_ok=True)
    L.dirname_pattern = str(dest)
    logger.info("%s: fast_update", username)
    try:
        user_info = L.context.get_iphone_json(f"api/v1/users/{platform_user_id}/info/", {})
        user_data = user_info["user"]
        user_data.setdefault("is_private", False)
        user_data.setdefault("full_name", "")
        user_data.setdefault("profile_pic_url", "")
        friendship = user_data.get("friendship_status", {})
        if not friendship.get("following", True):
            logger.warning("%s: not followed — deactivating", username)
            deactivate_account(account_id, db_path)
            return
        profile = instaloader.Profile.from_iphone_struct(L.context, user_data)
        for post in profile.get_posts():
            if _stop_event.is_set():
                return
            with download_lock:
                L.dirname_pattern = str(dest)
                downloaded = L.download_post(post, target=username)
            if not downloaded:
                break
            time.sleep(_lognormal_delay(2, 5))
    except (instaloader.LoginRequiredException, instaloader.AbortDownloadException):
        raise
    except instaloader.QueryReturnedBadRequestException as exc:
        raise RateLimitException(str(exc)) from exc
    except Exception as exc:
        if _is_rate_limited(exc):
            raise RateLimitException(str(exc)) from exc
        if _is_not_found(exc):
            logger.warning("%s: account not found (404) — deactivating", username)
            deactivate_account(account_id, db_path)
            return
        logger.error("%s: download failed — %s", username, exc)
    try:
        new_count = index_account(account_id, dest, db_path)
        if new_count:
            logger.info("%s: %d new file(s) indexed", username, new_count)
        else:
            logger.info("%s: already up to date", username)
    except Exception as exc:
        logger.error("%s: indexing failed — %s", username, exc)


def _fetch_new_posts(
    L: instaloader.Instaloader,
    active_accounts: list[tuple[int, str, str, int]],
    db_path: Path,
) -> None:
    to_check = [
        (account_id, ig_id, username)
        for account_id, ig_id, username, fully_synced in active_accounts
        if fully_synced == 1
    ]
    random.shuffle(to_check)
    cap = random.randint(_MIN_ACCOUNTS_PER_CYCLE, _MAX_ACCOUNTS_PER_CYCLE)
    to_check = to_check[:cap]

    if not to_check:
        logger.info("fetch_new_posts: no accounts to check")
        return

    logger.info("fetch_new_posts: checking %d account(s) (cap=%d)", len(to_check), cap)

    groups: list[list] = []
    i = 0
    while i < len(to_check):
        size = random.randint(15, 20)
        groups.append(to_check[i : i + size])
        i += size

    for g_idx, group in enumerate(groups):
        for a_idx, (account_id, ig_id, username) in enumerate(group):
            if _stop_event.is_set():
                return
            _download_account_fast(L, account_id, ig_id, username, db_path)
            if a_idx < len(group) - 1:
                _sleep(_lognormal_delay(30, 90))
        if g_idx < len(groups) - 1:
            _sleep(_lognormal_delay(300, 600), "between groups")


def _fetch_old_posts(L: instaloader.Instaloader, db_path: Path) -> None:
    if datetime.now().hour >= 22:
        logger.info("fetch_old_posts: skipped (after 22:00)")
        return

    unsynced = get_unsynced_accounts(db_path)
    if not unsynced:
        logger.info("fetch_old_posts: all accounts synced")
        return

    random.shuffle(unsynced)
    candidates = unsynced[:3]
    logger.info("fetch_old_posts: catching up %d account(s)", len(candidates))

    for i, (account_id, platform_user_id, username) in enumerate(candidates):
        if _stop_event.is_set():
            return
        dest = STORAGE_BASE / platform_user_id
        dest.mkdir(parents=True, exist_ok=True)
        L.dirname_pattern = str(dest)
        max_downloads = random.randint(_MIN_DOWNLOADS_PER_ACCOUNT, _MAX_DOWNLOADS_PER_ACCOUNT)
        logger.info("%s: catchup download (max=%d)", username, max_downloads)

        downloaded = 0
        try:
            user_info = L.context.get_iphone_json(f"api/v1/users/{platform_user_id}/info/", {})
            user_data = user_info["user"]
            user_data.setdefault("is_private", False)
            user_data.setdefault("full_name", "")
            user_data.setdefault("profile_pic_url", "")
            friendship = user_data.get("friendship_status", {})
            if not friendship.get("following", True):
                logger.warning("%s: not followed — deactivating", username)
                deactivate_account(account_id, db_path)
                continue
            profile = instaloader.Profile.from_iphone_struct(L.context, user_data)
            for post in profile.get_posts():
                if downloaded >= max_downloads:
                    break
                with download_lock:
                    L.dirname_pattern = str(dest)
                    did_download = L.download_post(post, target=username)
                if did_download:
                    downloaded += 1
        except (instaloader.LoginRequiredException, instaloader.AbortDownloadException):
            raise
        except instaloader.QueryReturnedBadRequestException as exc:
            raise RateLimitException(str(exc)) from exc
        except Exception as exc:
            if _is_rate_limited(exc):
                raise RateLimitException(str(exc)) from exc
            if _is_not_found(exc):
                logger.warning("%s: account not found (404) — deactivating", username)
                deactivate_account(account_id, db_path)
                continue
            logger.error("%s: catchup failed — %s", username, exc)

        if downloaded == 0:
            mark_account_synced(account_id, db_path)
            logger.info("%s: fully synced", username)
        else:
            logger.info("%s: %d post(s) fetched this cycle", username, downloaded)

        try:
            new_count = index_account(account_id, dest, db_path)
            if new_count:
                logger.info("%s: %d new file(s) indexed", username, new_count)
        except Exception as exc:
            logger.error("%s: indexing failed — %s", username, exc)

        if i < len(candidates) - 1:
            _sleep(_lognormal_delay(90, 180))


_SESSION_INVALIDATED_EXCEPTIONS = (
    instaloader.LoginRequiredException,
    instaloader.AbortDownloadException,
)


def _run_cycle() -> None:
    if DRY_RUN:
        logger.info("DRY_RUN — skipping downloads")
        return

    init_db(DB_PATH)
    migrate_done_files(DB_PATH, STORAGE_BASE)
    L = get_loader()
    if L is None:
        logger.warning("No session configured — skipping cycle")
        return
    if not L.context.username:
        logger.warning("No authenticated user — skipping cycle")
        return
    _set_session_headers(L)

    active_accounts = get_active_accounts(DB_PATH)
    if not active_accounts:
        logger.info("No active accounts — skipping cycle")
        return

    _fetch_new_posts(L, active_accounts, DB_PATH)
    _fetch_old_posts(L, DB_PATH)

    persist_session_cookies()


def _load_next_delay() -> int:
    """Return seconds until the next scheduled cycle, restored from DB if available."""
    try:
        stored = get_setting("next_run_at", DB_PATH)
    except Exception:
        stored = None

    if stored:
        try:
            next_run = datetime.fromisoformat(stored)
            secs = int((next_run - datetime.now()).total_seconds())
            if secs > 60:
                logger.info("Resuming — next download at %s (%s)", next_run.strftime("%m/%d %H:%M"), _fmt_delay(secs))
                return secs
            logger.info("Resuming — scheduled time passed, running soon")
            return 60
        except ValueError:
            pass

    delay = _lognormal_delay(5 * 60, 30 * 60)
    logger.info("Initial delay: %s", _fmt_delay(delay))
    return delay


async def _scheduler_loop() -> None:
    consecutive_rl = 0
    next_delay = _load_next_delay()

    while True:
        await asyncio.sleep(next_delay)
        await _wait_until_window()
        logger.info("Starting download cycle")

        try:
            await asyncio.to_thread(_run_cycle)
            consecutive_rl = 0
            now = datetime.now()
            tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            target_minute = random.randint(9 * 60, 12 * 60)
            next_run = tomorrow + timedelta(minutes=target_minute)
            next_delay = int((next_run - now).total_seconds())
            try:
                set_setting("next_run_at", next_run.isoformat(), DB_PATH)
            except Exception:
                pass
            logger.info("Next download at %s (%s)", next_run.strftime("%m/%d %H:%M"), _fmt_delay(next_delay))
        except RateLimitException:
            consecutive_rl += 1
            next_delay = min(_RATE_LIMIT_BACKOFF_BASE * (2 ** (consecutive_rl - 1)), _RATE_LIMIT_BACKOFF_MAX)
            retry_at = datetime.now() + timedelta(seconds=next_delay)
            try:
                set_setting("next_run_at", retry_at.isoformat(), DB_PATH)
            except Exception:
                pass
            logger.warning("Rate limited (%dx consecutive) — retry in %d min", consecutive_rl, next_delay // 60)
        except _SESSION_INVALIDATED_EXCEPTIONS as exc:
            logger.critical("Session invalidated — scheduler stopped. Update session ID at /settings. (%s)", exc)
            return
        except Exception as exc:
            next_delay = _RATE_LIMIT_BACKOFF_BASE
            logger.error("Unexpected error in cycle — retry in %d min: %s", next_delay // 60, exc, exc_info=True)


async def start_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return
    _stop_event.clear()
    set_setting("scheduler_enabled", "true", DB_PATH)
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Scheduler started")


async def stop_scheduler() -> None:
    global _scheduler_task
    set_setting("scheduler_enabled", "false", DB_PATH)
    _stop_event.set()
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    _scheduler_task = None
    logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    running = _scheduler_task is not None and not _scheduler_task.done()
    try:
        next_run_at = get_setting("next_run_at", DB_PATH)
    except Exception:
        next_run_at = None
    return {"running": running, "next_run_at": next_run_at}
