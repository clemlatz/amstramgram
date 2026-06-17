import json
import logging
import threading

import instaloader

from .config import DB_PATH, MEDIA_BASE
from .db import _conn, get_setting, set_setting

logger = logging.getLogger(__name__)

_loader: instaloader.Instaloader | None = None
# Protects dirname_pattern mutations + download_post calls on the shared loader instance.
import_lock = threading.Lock()


def get_loader() -> instaloader.Instaloader | None:
    global _loader
    if _loader is None:
        _loader = _build_loader()
    return _loader


def _make_instaloader() -> instaloader.Instaloader:
    L = instaloader.Instaloader(
        dirname_pattern=str(MEDIA_BASE / "{target}"),
        download_pictures=True,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=True,
        compress_json=False,
        post_metadata_txt_pattern="",
        storyitem_metadata_txt_pattern="",
        quiet=True,
    )

    def _quiet_error(msg, repeat_at_end=True):
        if repeat_at_end:
            L.context.error_log.append(msg)

    L.context.error = _quiet_error
    return L


def _build_loader() -> instaloader.Instaloader | None:
    session_id = get_setting("session_id", DB_PATH)
    if not session_id:
        logger.info("No session configured — loader inactive")
        return None

    L = _make_instaloader()
    cookies_json = get_setting("cookies", DB_PATH)

    if cookies_json:
        for c in json.loads(cookies_json):
            L.context._session.cookies.set(
                c["name"],
                c["value"],
                domain=c.get("domain", ".instagram.com"),
                path=c.get("path", "/"),
            )
        username = get_setting("username", DB_PATH)
        if not username:
            logger.error(
                "Cookies exist but username missing in DB — treating as unconfigured"
            )
            return None
        L.context.username = username
        logger.info("Loaded persisted session for %s (no network call)", username)
        return L
    else:
        L.context._session.cookies.set(
            "sessionid", session_id, domain=".instagram.com", path="/"
        )
        username = L.test_login()
        if username:
            L.context.username = username
            _save_all_to_db(L, session_id)
            logger.info("Authenticated as %s", username)
            return L
        else:
            logger.error("Authentication failed — update session ID at /settings")
            return None


def reload_session(new_session_id: str) -> str:
    global _loader
    old_session_id = get_setting("session_id", DB_PATH)
    old_suffix = f"…{old_session_id[-6:]}" if old_session_id else "none"
    new_suffix = f"…{new_session_id[-6:]}"
    L = _make_instaloader()
    L.context._session.cookies.set(
        "sessionid", new_session_id, domain=".instagram.com", path="/"
    )
    username = L.test_login()
    if not username:
        raise ValueError("Authentication failed")
    L.context.username = username
    _save_all_to_db(L, new_session_id)
    _loader = L
    logger.info("Session reloaded for %s (session id: %s → %s)", username, old_suffix, new_suffix)
    return username


def persist_session_cookies() -> None:
    if _loader is None:
        return
    cookies_list = [
        {"name": c.name, "value": c.value, "domain": c.domain, "path": c.path}
        for c in _loader.context._session.cookies
    ]
    set_setting("cookies", json.dumps(cookies_list), DB_PATH)


def _save_all_to_db(L: instaloader.Instaloader, session_id: str) -> None:
    cookies_list = [
        {"name": c.name, "value": c.value, "domain": c.domain, "path": c.path}
        for c in L.context._session.cookies
    ]
    entries = [
        ("session_id", session_id),
        ("username", L.context.username),
        ("cookies", json.dumps(cookies_list)),
    ]
    conn = _conn(DB_PATH)
    try:
        for key, value in entries:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)"
                " ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                (key, value),
            )
        conn.commit()
    finally:
        conn.close()
