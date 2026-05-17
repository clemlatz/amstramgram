import logging
import time
from pathlib import Path

import instaloader

from .db import (
    MEDIA_EXTS,
    index_account,
    mark_as_saved_posts,
    shortcode_exists,
    upsert_account,
)
from .loader import download_lock
from .scheduler import RateLimitException, _is_rate_limited, _lognormal_delay, _set_session_headers

logger = logging.getLogger(__name__)

_TYPE_LABELS = {
    "GraphImage": "image",
    "GraphVideo": "video",
    "GraphSidecar": "carousel",
}


def sync_saved_posts(
    L: instaloader.Instaloader, db_path: Path, storage_base: Path
) -> tuple[int, list[str]]:
    """Download saved posts, stopping at the first already-indexed shortcode.

    Verifies each download on disk and in DB after each post; aborts if a post fails to land.
    Returns (downloaded_count, new_account_platform_user_ids).
    Raises RateLimitException, LoginRequiredException, or AbortDownloadException on hard failures.
    """
    _set_session_headers(L)
    L.download_videos = True

    saved_shortcodes: list[str] = []
    new_platform_user_ids: list[str] = []

    own_profile = instaloader.Profile.own_profile(L.context)

    try:
        for post in own_profile.get_saved_posts():
            shortcode = post.shortcode
            type_label = _TYPE_LABELS.get(post.typename, post.typename)

            if shortcode_exists(shortcode, db_path):
                logger.info("sync-saved: [%s] %s — already indexed, stopping", type_label, shortcode)
                break

            username = post.owner_username
            platform_user_id = str(post.owner_id)

            account_id, is_new = upsert_account(username, platform_user_id, db_path)
            if is_new:
                new_platform_user_ids.append(platform_user_id)

            dest = storage_base / platform_user_id
            dest.mkdir(parents=True, exist_ok=True)

            before = {f for f in dest.iterdir() if f.is_file() and f.suffix.lower() in MEDIA_EXTS}

            logger.info("sync-saved: [%s] %s from @%s — downloading", type_label, shortcode, username)
            try:
                with download_lock:
                    L.dirname_pattern = str(dest)
                    L.download_post(post, target=username)
            except Exception as exc:
                if _is_rate_limited(exc):
                    raise RateLimitException(str(exc)) from exc
                logger.error("sync-saved: [%s] %s — download error: %s", type_label, shortcode, exc)
                continue

            after = {f for f in dest.iterdir() if f.is_file() and f.suffix.lower() in MEDIA_EXTS}
            new_files = after - before

            if not new_files:
                logger.error(
                    "sync-saved: [%s] %s — no media files on disk after download, aborting",
                    type_label, shortcode,
                )
                break

            try:
                index_account(account_id, dest, db_path)
            except Exception as exc:
                logger.error(
                    "sync-saved: [%s] %s — indexing failed: %s, aborting",
                    type_label, shortcode, exc,
                )
                break

            if not shortcode_exists(shortcode, db_path):
                logger.error(
                    "sync-saved: [%s] %s — files on disk but not in DB after indexing, aborting",
                    type_label, shortcode,
                )
                break

            logger.info(
                "sync-saved: [%s] %s ✓ — %d file(s) saved and indexed",
                type_label, shortcode, len(new_files),
            )
            saved_shortcodes.append(shortcode)
            time.sleep(_lognormal_delay(2, 5))

    except (instaloader.LoginRequiredException, instaloader.AbortDownloadException):
        raise
    except instaloader.QueryReturnedBadRequestException as exc:
        raise RateLimitException(str(exc)) from exc
    except RateLimitException:
        raise
    except Exception as exc:
        if _is_rate_limited(exc):
            raise RateLimitException(str(exc)) from exc
        logger.error("sync-saved: unexpected error — %s", exc, exc_info=True)

    L.download_videos = False
    mark_as_saved_posts(saved_shortcodes, db_path)
    logger.info("sync-saved: done — %d post(s) downloaded", len(saved_shortcodes))
    return len(saved_shortcodes), new_platform_user_ids
