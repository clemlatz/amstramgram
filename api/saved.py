import logging
import time
from pathlib import Path

import instaloader

from .db import (
    get_all_shortcodes_set,
    index_account,
    mark_as_saved_posts,
    record_saved_seen,
    upsert_account,
)
from .loader import download_lock
from .scheduler import RateLimitException, _is_rate_limited, _lognormal_delay, _set_session_headers

logger = logging.getLogger(__name__)


def sync_saved_posts(
    L: instaloader.Instaloader, db_path: Path, storage_base: Path
) -> tuple[int, list[str]]:
    """Download new saved posts, stopping at the first already-known shortcode.

    Returns (downloaded_count, new_account_platform_user_ids).
    Raises RateLimitException, LoginRequiredException, or AbortDownloadException on hard failures.
    """
    _set_session_headers(L)
    known_shortcodes = get_all_shortcodes_set(db_path)

    saved_shortcodes: list[str] = []
    accounts_touched: dict[int, tuple[str, Path]] = {}
    new_platform_user_ids: list[str] = []

    own_profile = instaloader.Profile.own_profile(L.context)

    try:
        for post in own_profile.get_saved_posts():
            shortcode = post.shortcode

            if shortcode in known_shortcodes:
                logger.info("sync-saved: reached known shortcode %s — stopping", shortcode)
                break

            if post.is_video:
                logger.debug("sync-saved: skipping video %s", shortcode)
                record_saved_seen(shortcode, db_path)
                known_shortcodes.add(shortcode)
                continue

            username = post.owner_username
            platform_user_id = str(post.owner_id)

            account_id, is_new = upsert_account(username, platform_user_id, db_path)
            if is_new:
                new_platform_user_ids.append(platform_user_id)

            dest = storage_base / platform_user_id
            dest.mkdir(parents=True, exist_ok=True)
            L.dirname_pattern = str(dest)

            logger.info("sync-saved: downloading %s from @%s", shortcode, username)
            try:
                with download_lock:
                    L.dirname_pattern = str(dest)
                    L.download_post(post, target=username)
            except Exception as exc:
                if _is_rate_limited(exc):
                    raise RateLimitException(str(exc)) from exc
                logger.error("sync-saved: download failed for %s — %s", shortcode, exc)
                continue

            saved_shortcodes.append(shortcode)
            accounts_touched[account_id] = (username, dest)
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

    for account_id, (username, dest) in accounts_touched.items():
        try:
            new_count = index_account(account_id, dest, db_path)
            if new_count:
                logger.info("sync-saved: %d file(s) indexed for @%s", new_count, username)
        except Exception as exc:
            logger.error("sync-saved: indexing failed for @%s — %s", username, exc)

    mark_as_saved_posts(saved_shortcodes, db_path)
    logger.info("sync-saved: done — %d post(s) downloaded", len(saved_shortcodes))
    return len(saved_shortcodes), new_platform_user_ids
