"""
Monkey-patches for third-party libraries.

Each patch targets a specific known bug and is a no-op once the upstream fix
is released (the old identifier will no longer appear in library code).
"""

import logging

logger = logging.getLogger(__name__)

# https://github.com/instaloader/instaloader/issues/2695
# Instagram changed the GraphQL doc_id used to fetch profile metadata.
# Instaloader 4.15.1 still ships the stale doc_id, causing 400 "invalid request".
_STALE_DOC_ID = "25980296051578533"
_FIXED_DOC_ID = "27937681195819736"
_EXTRA_VARS = {
    "__relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider": False,
    "enable_integrity_filters": True,
}


def _apply_instaloader_graphql_fix() -> None:
    try:
        from instaloader.instaloadercontext import InstaloaderContext

        _original = InstaloaderContext.doc_id_graphql_query

        def _patched(self, doc_id, variables, referer=None):
            if doc_id == _STALE_DOC_ID:
                doc_id = _FIXED_DOC_ID
                variables = {**variables, **_EXTRA_VARS}
            return _original(self, doc_id, variables, referer)

        InstaloaderContext.doc_id_graphql_query = _patched
        logger.info("Applied instaloader graphql doc_id patch (issue #2695)")
    except Exception as exc:
        logger.warning("Could not apply instaloader graphql patch: %s", exc)


def apply_all() -> None:
    _apply_instaloader_graphql_fix()
