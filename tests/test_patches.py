from unittest.mock import MagicMock, patch


def _make_context():
    calls = []

    def fake_original(self, doc_id, variables, referer=None):
        calls.append({"doc_id": doc_id, "variables": variables, "referer": referer})
        return {}

    ctx = MagicMock()
    return ctx, calls, fake_original


def test_patch_replaces_stale_doc_id():
    from api.patches import _STALE_DOC_ID, _FIXED_DOC_ID, _EXTRA_VARS, _apply_instaloader_graphql_fix

    with patch("instaloader.instaloadercontext.InstaloaderContext.doc_id_graphql_query") as mock_orig:
        _apply_instaloader_graphql_fix()
        from instaloader.instaloadercontext import InstaloaderContext

        ctx = MagicMock()
        InstaloaderContext.doc_id_graphql_query(ctx, _STALE_DOC_ID, {"id": "123"})

        call_args = mock_orig.call_args
        assert call_args[0][1] == _FIXED_DOC_ID
        for key, value in _EXTRA_VARS.items():
            assert call_args[0][2][key] == value


def test_patch_passes_through_other_doc_ids():
    from api.patches import _STALE_DOC_ID, _apply_instaloader_graphql_fix

    other_doc_id = "99999999999999999"
    with patch("instaloader.instaloadercontext.InstaloaderContext.doc_id_graphql_query") as mock_orig:
        _apply_instaloader_graphql_fix()
        from instaloader.instaloadercontext import InstaloaderContext

        ctx = MagicMock()
        variables = {"id": "456"}
        InstaloaderContext.doc_id_graphql_query(ctx, other_doc_id, variables)

        call_args = mock_orig.call_args
        assert call_args[0][1] == other_doc_id
        assert call_args[0][2] == variables


def test_patch_forwards_referer():
    from api.patches import _STALE_DOC_ID, _apply_instaloader_graphql_fix

    with patch("instaloader.instaloadercontext.InstaloaderContext.doc_id_graphql_query") as mock_orig:
        _apply_instaloader_graphql_fix()
        from instaloader.instaloadercontext import InstaloaderContext

        ctx = MagicMock()
        InstaloaderContext.doc_id_graphql_query(
            ctx, _STALE_DOC_ID, {"id": "123"}, referer="https://www.instagram.com/"
        )

        call_args = mock_orig.call_args
        assert call_args[0][3] == "https://www.instagram.com/"


def test_patch_preserves_existing_variables():
    from api.patches import _STALE_DOC_ID, _apply_instaloader_graphql_fix

    with patch("instaloader.instaloadercontext.InstaloaderContext.doc_id_graphql_query") as mock_orig:
        _apply_instaloader_graphql_fix()
        from instaloader.instaloadercontext import InstaloaderContext

        ctx = MagicMock()
        original_vars = {"id": "789", "render_surface": "PROFILE"}
        InstaloaderContext.doc_id_graphql_query(ctx, _STALE_DOC_ID, original_vars)

        merged = mock_orig.call_args[0][2]
        assert merged["id"] == "789"
        assert merged["render_surface"] == "PROFILE"
