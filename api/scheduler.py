import asyncio
import logging
import math
import random
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

import instaloader

from .config import (
    DB_PATH,
    DRY_RUN,
    MEDIA_BASE,
    STORAGE_BASE,
    IMPORT_ACCOUNTS_PER_CYCLE_MAX,
    IMPORT_ACCOUNTS_PER_CYCLE_MIN,
    IMPORT_ACCOUNT_DELAY_MAX,
    IMPORT_ACCOUNT_DELAY_MIN,
    IMPORT_BACKFILL_DELAY_MAX,
    IMPORT_BACKFILL_DELAY_MIN,
    IMPORT_BACKFILL_MAX,
    IMPORT_BACKFILL_MIN,
    IMPORT_CYCLE_DELAY_MAX,
    IMPORT_CYCLE_DELAY_MIN,
    IMPORT_GROUP_DELAY_MAX,
    IMPORT_GROUP_DELAY_MIN,
    IMPORT_INITIAL_DELAY_MAX,
    IMPORT_INITIAL_DELAY_MIN,
    IMPORT_MAX_RECENT_POSTS,
    IMPORT_MORNING_JITTER_MAX,
    IMPORT_MORNING_JITTER_MIN,
    IMPORT_POST_DELAY_MAX,
    IMPORT_POST_DELAY_MIN,
    IMPORT_ENABLE_BACKFILL,
    IMPORT_RATE_LIMIT_BACKOFF_BASE,
    IMPORT_RATE_LIMIT_BACKOFF_MAX,
    IMPORT_RATE_LIMIT_RETRIES,
)
from .db import (
    deactivate_account,
    get_active_accounts,
    get_setting,
    get_not_fully_imported_accounts,
    index_account,
    init_db,
    mark_account_fully_imported,
    migrate_done_files,
    set_setting,
)
from .loader import import_lock, get_loader, persist_session_cookies
from .notifier import send_telegram_alert

logger = logging.getLogger(__name__)

_TYPE_LABELS = {
    "GraphImage": "image",
    "GraphSidecar": "carousel",
    "GraphVideo": "video",
}


_stop_event: threading.Event = threading.Event()
_scheduler_task: asyncio.Task | None = None
_cycle_running: bool = False


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
    label = f" ({reason})" if reason else ""
    if seconds < 3600:
        logger.info("Waiting %s%s", _fmt_delay(seconds), label)
    else:
        until = datetime.now() + timedelta(seconds=seconds)
        until_str = (
            until.strftime("%H:%M:%S")
            if until.date() == datetime.now().date()
            else until.strftime("%m/%d %H:%M:%S")
        )
        logger.info("Waiting until %s%s", until_str, label)
    _stop_event.wait(timeout=seconds)


class RateLimitException(Exception):
    pass


def _backoff_delay(consecutive: int) -> int:
    cap = min(
        IMPORT_RATE_LIMIT_BACKOFF_BASE * (2 ** (consecutive - 1)), IMPORT_RATE_LIMIT_BACKOFF_MAX
    )
    return int(random.uniform(cap / 2, cap))


def _is_rate_limited(exc: Exception) -> bool:
    if isinstance(exc, instaloader.TooManyRequestsException):
        return True
    msg = str(exc)
    return ("401" in msg and "wait" in msg.lower()) or "429" in msg


def _is_not_found(exc: Exception) -> bool:
    return "404" in str(exc)


def _is_stale_graphql_query(exc: Exception) -> bool:
    msg = str(exc)
    return "invalid request" in msg.lower() and "graphql/query" in msg


def _is_logged_out(exc: Exception) -> bool:
    return "user_has_logged_out" in str(exc)


class SessionExpiredException(Exception):
    pass


def _fmt_import_summary(type_counts: dict[str, int]) -> str:
    parts = []
    for key in ("image", "carousel", "video", "media"):
        n = type_counts.get(key, 0)
        if n:
            parts.append(f"{n} {key}{'s' if n > 1 else ''}")
    if not parts:
        return "nothing new"
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + " and " + parts[-1]


def _post_has_video(post) -> bool:
    if post.is_video:
        return True
    if post.typename == "GraphSidecar":
        return any(node.is_video for node in post.get_sidecar_nodes())
    return False


def _lognormal_delay(low: int, high: int) -> int:
    """Return a random integer delay in [low, high] with a log-normal distribution."""
    mid = (low + high) / 2
    sigma = 0.4
    mu = math.log(mid)
    return int(max(low, min(high, random.lognormvariate(mu, sigma))))


_DEFAULT_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/274.0.0.0"


def _set_session_headers(L: instaloader.Instaloader) -> None:
    ua = get_setting("user_agent", DB_PATH) or _DEFAULT_USER_AGENT
    L.context._session.headers.update(
        {
            "X-IG-App-ID": "936619743392459",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.instagram.com/",
            "User-Agent": ua,
        }
    )


async def _wait_until_window() -> None:
    now = datetime.now()
    if 7 <= now.hour < 23:
        return
    if now.hour < 7:
        target = now.replace(hour=7, minute=0, second=0, microsecond=0)
    else:
        target = (now + timedelta(days=1)).replace(
            hour=7, minute=0, second=0, microsecond=0
        )
    jitter = _lognormal_delay(IMPORT_MORNING_JITTER_MIN, IMPORT_MORNING_JITTER_MAX)
    delay = (target - now).total_seconds() + jitter
    resume_at = now + timedelta(seconds=delay)
    logger.info(
        "Outside active window — sleeping until %s (%.0f min)",
        resume_at.strftime("%H:%M"),
        delay / 60,
    )
    await asyncio.sleep(delay)


def _import_account(
    L: instaloader.Instaloader,
    account_id: int,
    platform_user_id: str,
    username: str,
    db_path: Path,
    max_posts: int | None = None,
) -> int:
    dest = MEDIA_BASE / platform_user_id
    dest.mkdir(parents=True, exist_ok=True)
    L.dirname_pattern = str(dest)
    suffix = f" (max={max_posts})" if max_posts is not None else ""
    logger.info("%s: importing new media…%s", username, suffix)
    fetched = 0
    type_counts: dict[str, int] = {}
    try:
        user_info = L.context.get_iphone_json(
            f"api/v1/users/{platform_user_id}/info/", {}
        )
        user_data = user_info["user"]
        user_data.setdefault("is_private", False)
        user_data.setdefault("full_name", "")
        user_data.setdefault("profile_pic_url", "")
        friendship = user_data.get("friendship_status", {})
        if not friendship.get("following", True):
            logger.warning("%s: not followed — deactivating", username)
            deactivate_account(account_id, db_path)
            return 0
        profile = instaloader.Profile.from_iphone_struct(L.context, user_data)
        for post in profile.get_posts():
            if _stop_event.is_set():
                return fetched
            if _post_has_video(post):
                continue
            if max_posts is not None and fetched >= max_posts:
                break
            with import_lock:
                L.dirname_pattern = str(dest)
                did_import = L.download_post(post, target=username)
            if not did_import and max_posts is None:
                break
            if did_import:
                type_label = _TYPE_LABELS.get(post.typename, "media")
                type_counts[type_label] = type_counts.get(type_label, 0) + 1
                fetched += 1
                time.sleep(_lognormal_delay(IMPORT_POST_DELAY_MIN, IMPORT_POST_DELAY_MAX))
    except (instaloader.LoginRequiredException, instaloader.AbortDownloadException):
        raise
    except instaloader.QueryReturnedBadRequestException as exc:
        if _is_stale_graphql_query(exc):
            logger.error(
                "%s: Instaloader GraphQL query outdated — run: pip install --upgrade instaloader",
                username,
            )
            return fetched
        logger.warning("%s: rate-limit via %s — %s", username, type(exc).__name__, exc)
        raise RateLimitException(str(exc)) from exc
    except instaloader.PrivateProfileNotFollowedException:
        logger.warning("%s: private profile, not followed — deactivating", username)
        deactivate_account(account_id, db_path)
        return fetched
    except Exception as exc:
        if _is_logged_out(exc):
            raise SessionExpiredException(str(exc)) from exc
        if _is_rate_limited(exc):
            logger.warning(
                "%s: rate-limit via %s — %s", username, type(exc).__name__, exc
            )
            raise RateLimitException(str(exc)) from exc
        if _is_not_found(exc):
            logger.warning("%s: account not found (404) — deactivating", username)
            deactivate_account(account_id, db_path)
            return fetched
        logger.error("%s: import failed — %s", username, exc)
    if fetched:
        logger.info("%s: imported %s", username, _fmt_import_summary(type_counts))
    else:
        logger.info("%s: up to date", username)
    try:
        index_account(account_id, dest, db_path, STORAGE_BASE)
    except Exception as exc:
        logger.error("%s: indexing failed — %s", username, exc)
    return fetched


def _fetch_new_posts(
    L: instaloader.Instaloader,
    active_accounts: list[tuple[int, str, str, int]],
    db_path: Path,
) -> dict[str, int]:
    # Fully imported accounts: stop at the first already-known post (unlimited fast_update).
    # Not yet fully imported accounts: fetch only the N most recent posts so the feed stays fresh
    # while _fetch_old_posts handles the historical backfill separately.
    to_check = [
        (account_id, ig_id, username, None if fully_imported else IMPORT_MAX_RECENT_POSTS)
        for account_id, ig_id, username, fully_imported in active_accounts
    ]
    random.shuffle(to_check)
    cap = random.randint(IMPORT_ACCOUNTS_PER_CYCLE_MIN, IMPORT_ACCOUNTS_PER_CYCLE_MAX)
    to_check = to_check[:cap]

    if not to_check:
        logger.info("fetch_new_posts: no accounts to check")
        return {}

    logger.info("fetch_new_posts: checking %d account(s)… (cap=%d)", len(to_check), cap)

    groups: list[list] = []
    i = 0
    while i < len(to_check):
        size = random.randint(15, 20)
        groups.append(to_check[i : i + size])
        i += size

    account_counts: dict[str, int] = {}
    total_imported = 0
    for g_idx, group in enumerate(groups):
        for a_idx, (account_id, ig_id, username, max_posts) in enumerate(group):
            if _stop_event.is_set():
                return account_counts
            count = _import_account(
                L, account_id, ig_id, username, db_path, max_posts=max_posts
            )
            if count:
                account_counts[username] = account_counts.get(username, 0) + count
            total_imported += count
            if a_idx < len(group) - 1:
                _sleep(_lognormal_delay(IMPORT_ACCOUNT_DELAY_MIN, IMPORT_ACCOUNT_DELAY_MAX))
        if g_idx < len(groups) - 1:
            _sleep(_lognormal_delay(IMPORT_GROUP_DELAY_MIN, IMPORT_GROUP_DELAY_MAX), "between groups")
    logger.info("fetch_new_posts: done — %d imported", total_imported)
    return account_counts


def _fetch_old_posts(L: instaloader.Instaloader, db_path: Path) -> dict[str, int]:
    if not IMPORT_ENABLE_BACKFILL:
        logger.info("fetch_old_posts: disabled (IMPORT_ENABLE_BACKFILL)")
        return {}

    not_fully_imported = get_not_fully_imported_accounts(db_path)
    if not not_fully_imported:
        logger.info("fetch_old_posts: all accounts fully imported")
        return {}

    random.shuffle(not_fully_imported)
    candidates = not_fully_imported[:3]
    logger.info("fetch_old_posts: catching up %d account(s)…", len(candidates))

    account_counts: dict[str, int] = {}
    total_imported = 0
    for i, (account_id, platform_user_id, username) in enumerate(candidates):
        if _stop_event.is_set():
            return account_counts
        dest = MEDIA_BASE / platform_user_id
        dest.mkdir(parents=True, exist_ok=True)
        L.dirname_pattern = str(dest)
        max_imports = random.randint(IMPORT_BACKFILL_MIN, IMPORT_BACKFILL_MAX)
        logger.info("%s: importing new media… (max=%d)", username, max_imports)

        imported = 0
        type_counts: dict[str, int] = {}
        try:
            user_info = L.context.get_iphone_json(
                f"api/v1/users/{platform_user_id}/info/", {}
            )
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
                if _stop_event.is_set():
                    return account_counts
                if imported >= max_imports:
                    break
                if _post_has_video(post):
                    continue
                with import_lock:
                    L.dirname_pattern = str(dest)
                    did_import = L.download_post(post, target=username)
                if did_import:
                    type_label = _TYPE_LABELS.get(post.typename, "media")
                    type_counts[type_label] = type_counts.get(type_label, 0) + 1
                    imported += 1
        except (instaloader.LoginRequiredException, instaloader.AbortDownloadException):
            raise
        except instaloader.QueryReturnedBadRequestException as exc:
            if _is_stale_graphql_query(exc):
                logger.error(
                    "%s: Instaloader GraphQL query outdated — run: pip install --upgrade instaloader",
                    username,
                )
                continue
            logger.warning(
                "%s: rate-limit via %s — %s", username, type(exc).__name__, exc
            )
            raise RateLimitException(str(exc)) from exc
        except instaloader.PrivateProfileNotFollowedException:
            logger.warning("%s: private profile, not followed — deactivating", username)
            deactivate_account(account_id, db_path)
            continue
        except Exception as exc:
            if _is_logged_out(exc):
                raise SessionExpiredException(str(exc)) from exc
            if _is_rate_limited(exc):
                logger.warning(
                    "%s: rate-limit via %s — %s", username, type(exc).__name__, exc
                )
                raise RateLimitException(str(exc)) from exc
            if _is_not_found(exc):
                logger.warning("%s: account not found (404) — deactivating", username)
                deactivate_account(account_id, db_path)
                continue
            logger.error("%s: catchup failed — %s", username, exc)

        total_imported += imported
        if imported:
            account_counts[username] = account_counts.get(username, 0) + imported
        if imported == 0:
            mark_account_fully_imported(account_id, db_path)
            logger.info("%s: fully imported", username)
        else:
            logger.info("%s: imported %s", username, _fmt_import_summary(type_counts))

        try:
            index_account(account_id, dest, db_path, STORAGE_BASE)
        except Exception as exc:
            logger.error("%s: indexing failed — %s", username, exc)

        if i < len(candidates) - 1:
            _sleep(_lognormal_delay(IMPORT_BACKFILL_DELAY_MIN, IMPORT_BACKFILL_DELAY_MAX))
    logger.info("fetch_old_posts: done — %d imported", total_imported)
    return account_counts


_SESSION_INVALIDATED_EXCEPTIONS = (
    instaloader.LoginRequiredException,
    instaloader.AbortDownloadException,
    instaloader.BadCredentialsException,
    instaloader.TwoFactorAuthRequiredException,
    SessionExpiredException,
)


def _run_cycle() -> dict[str, int]:
    if DRY_RUN:
        logger.info("DRY_RUN — skipping import")
        return {}

    init_db(DB_PATH)
    migrate_done_files(DB_PATH, MEDIA_BASE)
    L = get_loader()
    if L is None:
        logger.warning("No session configured — skipping cycle")
        return {}
    if not L.context.username:
        logger.warning("No authenticated user — skipping cycle")
        return {}
    _set_session_headers(L)

    active_accounts = get_active_accounts(DB_PATH)
    if not active_accounts:
        logger.info("No active accounts — skipping cycle")
        return {}

    new_counts = _fetch_new_posts(L, active_accounts, DB_PATH)
    old_counts = _fetch_old_posts(L, DB_PATH)

    account_counts: dict[str, int] = dict(new_counts)
    for username, count in old_counts.items():
        account_counts[username] = account_counts.get(username, 0) + count

    persist_session_cookies()
    logger.info("Import cycle complete")
    return account_counts


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
                logger.info(
                    "Resuming — next import at %s (%s)",
                    next_run.strftime("%m/%d %H:%M"),
                    _fmt_delay(secs),
                )
                return secs
            logger.info("Resuming — scheduled time passed, running soon")
            return 60
        except ValueError:
            pass

    delay = _lognormal_delay(IMPORT_INITIAL_DELAY_MIN, IMPORT_INITIAL_DELAY_MAX)
    logger.info("Initial delay: %s", _fmt_delay(delay))
    return delay


async def _scheduler_loop() -> None:
    consecutive_rl = 0
    next_delay = _load_next_delay()

    while True:
        await asyncio.sleep(next_delay)
        await _wait_until_window()
        logger.info("Starting import cycle")
        await asyncio.to_thread(send_telegram_alert, "🔄 Import cycle starting…")

        global _cycle_running
        _cycle_running = True
        try:
            account_counts = await asyncio.to_thread(_run_cycle)
            total = sum(account_counts.values())
            if total:
                lines = [f"✅ Import complete — {total} post{'s' if total > 1 else ''} imported"]
                for username, count in sorted(account_counts.items(), key=lambda x: -x[1]):
                    lines.append(f"  @{username}: {count}")
                msg = "\n".join(lines)
            else:
                msg = "✅ Import complete — nothing new"
            await asyncio.to_thread(send_telegram_alert, msg)
            consecutive_rl = 0
            next_delay = _lognormal_delay(IMPORT_CYCLE_DELAY_MIN, IMPORT_CYCLE_DELAY_MAX)
            next_run = datetime.now() + timedelta(seconds=next_delay)
            try:
                set_setting("next_run_at", next_run.isoformat(), DB_PATH)
            except Exception:
                pass
            logger.info(
                "Next import at %s (%s)",
                next_run.strftime("%m/%d %H:%M"),
                _fmt_delay(next_delay),
            )
        except RateLimitException as exc:
            consecutive_rl += 1
            if consecutive_rl >= IMPORT_RATE_LIMIT_RETRIES:
                logger.critical(
                    "Rate limited %d times consecutively — scheduler stopped. (%s)",
                    consecutive_rl,
                    exc,
                )
                set_setting("scheduler_enabled", "false", DB_PATH)
                await asyncio.to_thread(
                    send_telegram_alert,
                    f"⚠️ Scheduler stopped: rate limited {consecutive_rl} times consecutively.",
                )
                return
            next_delay = _backoff_delay(consecutive_rl)
            retry_at = datetime.now() + timedelta(seconds=next_delay)
            try:
                set_setting("next_run_at", retry_at.isoformat(), DB_PATH)
            except Exception:
                pass
            logger.warning(
                "Rate limited (attempt %d/%d) — retry in %s (next at %s)",
                consecutive_rl,
                IMPORT_RATE_LIMIT_RETRIES - 1,
                _fmt_delay(next_delay),
                retry_at.strftime("%H:%M"),
            )
        except _SESSION_INVALIDATED_EXCEPTIONS as exc:
            logger.critical(
                "Session invalidated — scheduler stopped. Update session ID at /settings. (%s)",
                exc,
            )
            set_setting("scheduler_enabled", "false", DB_PATH)
            await asyncio.to_thread(
                send_telegram_alert,
                f"⚠️ Scheduler stopped: session invalidated ({type(exc).__name__}).",
            )
            return
        except instaloader.ConnectionException as exc:
            next_delay = IMPORT_RATE_LIMIT_BACKOFF_BASE
            retry_at = datetime.now() + timedelta(seconds=next_delay)
            try:
                set_setting("next_run_at", retry_at.isoformat(), DB_PATH)
            except Exception:
                pass
            logger.warning(
                "Network error — retry in %s: %s", _fmt_delay(next_delay), exc
            )
        except Exception as exc:
            consecutive_rl += 1
            if consecutive_rl >= IMPORT_RATE_LIMIT_RETRIES:
                logger.critical(
                    "Too many consecutive errors (%d) — scheduler stopped: %s",
                    consecutive_rl,
                    exc,
                )
                set_setting("scheduler_enabled", "false", DB_PATH)
                await asyncio.to_thread(
                    send_telegram_alert,
                    f"⚠️ Scheduler stopped: {consecutive_rl} consecutive errors — {str(exc)[:100]}.",
                )
                return
            next_delay = _backoff_delay(consecutive_rl)
            retry_at = datetime.now() + timedelta(seconds=next_delay)
            try:
                set_setting("next_run_at", retry_at.isoformat(), DB_PATH)
            except Exception:
                pass
            logger.error(
                "Unexpected error in cycle (attempt %d/%d) — retry in %s: %s",
                consecutive_rl,
                IMPORT_RATE_LIMIT_RETRIES - 1,
                _fmt_delay(next_delay),
                exc,
                exc_info=True,
            )
        finally:
            _cycle_running = False


async def start_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return
    _stop_event.clear()
    set_setting("scheduler_enabled", "true", DB_PATH)
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Scheduler started")
    backfill_info = (
        f"enabled ({IMPORT_BACKFILL_MIN}–{IMPORT_BACKFILL_MAX} posts)"
        if IMPORT_ENABLE_BACKFILL
        else "disabled"
    )
    logger.info(
        "Config — accounts/cycle: %d–%d | recent posts cap: %d | backfill: %s | "
        "delays: post %d–%ds, account %d–%ds, group %d–%ds, backfill %d–%ds | "
        "cycle every %s–%s | rate-limit retries: %d",
        IMPORT_ACCOUNTS_PER_CYCLE_MIN, IMPORT_ACCOUNTS_PER_CYCLE_MAX,
        IMPORT_MAX_RECENT_POSTS,
        backfill_info,
        IMPORT_POST_DELAY_MIN, IMPORT_POST_DELAY_MAX,
        IMPORT_ACCOUNT_DELAY_MIN, IMPORT_ACCOUNT_DELAY_MAX,
        IMPORT_GROUP_DELAY_MIN, IMPORT_GROUP_DELAY_MAX,
        IMPORT_BACKFILL_DELAY_MIN, IMPORT_BACKFILL_DELAY_MAX,
        _fmt_delay(IMPORT_CYCLE_DELAY_MIN), _fmt_delay(IMPORT_CYCLE_DELAY_MAX),
        IMPORT_RATE_LIMIT_RETRIES,
    )


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
    return {
        "running": running,
        "cycle_running": _cycle_running,
        "next_run_at": next_run_at,
    }
