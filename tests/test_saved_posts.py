from unittest.mock import MagicMock, patch

from api.db import init_db


def _make_post(shortcode, typename="GraphImage", owner_id=111, username="alice"):
    post = MagicMock()
    post.shortcode = shortcode
    post.typename = typename
    post.owner_username = username
    post.owner_id = owner_id
    return post


def _run_sync(tmp_path, posts, *, shortcode_exists=False, download_side_effect=None):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    storage.mkdir()

    L = MagicMock()
    if download_side_effect:
        L.download_post.side_effect = download_side_effect

    profile = MagicMock()
    profile.get_saved_posts.return_value = posts

    se_kwargs = (
        {"side_effect": shortcode_exists}
        if isinstance(shortcode_exists, list)
        else {"return_value": shortcode_exists}
    )

    with (
        patch("api.saved.instaloader.Profile.own_profile", return_value=profile),
        patch("api.saved._set_session_headers"),
        patch("api.saved.upsert_account", return_value=(1, False)),
        patch("api.saved.import_lock"),
        patch("api.saved.index_account") as mock_index,
        patch("api.saved.shortcode_exists", **se_kwargs),
        patch("api.saved.mark_as_saved_posts"),
        patch("api.saved.time.sleep"),
    ):
        from api.saved import sync_saved_posts

        count, new_ids = sync_saved_posts(L, db, storage)

    return count, new_ids, L, mock_index


def test_sync_counts_synced_post(tmp_path):
    storage = tmp_path / "storage"

    def fake_download(p, target):
        dest = storage / "111"
        dest.mkdir(parents=True, exist_ok=True)
        (dest / f"{p.shortcode}.mp4").write_bytes(b"x")

    # First call (early-exit check): not in DB → proceed
    # Second call (post-indexing verification): in DB → success
    count, _, _, mock_index = _run_sync(
        tmp_path,
        [_make_post("VID001", typename="GraphVideo")],
        shortcode_exists=[False, True],
        download_side_effect=fake_download,
    )

    assert count == 1
    mock_index.assert_called_once()


def test_sync_stops_at_already_indexed_post(tmp_path):
    # First post already in DB → stop before syncing anything
    count, _, L, mock_index = _run_sync(
        tmp_path,
        [_make_post("KNOWN01"), _make_post("NEXT01")],
        shortcode_exists=True,
    )

    assert count == 0
    assert L.download_post.call_count == 0
    mock_index.assert_not_called()


def test_sync_aborts_when_sync_produces_no_files(tmp_path):
    # Sync produces no files and shortcode not in DB → abort after first post
    count, _, L, mock_index = _run_sync(
        tmp_path,
        [_make_post("BAD001"), _make_post("NEXT01")],
        shortcode_exists=False,
    )

    assert count == 0
    assert L.download_post.call_count == 1
    mock_index.assert_not_called()
