import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from .config import DB_PATH, ENABLE_ACCESS_LOG, LOG_PATH
from .db import get_setting, init_db
from .logs import AppLogHandler, init_log_buffer
from .routes import accounts, feed, media, random, rate, settings, stats, userscript
from .scheduler import start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

if not ENABLE_ACCESS_LOG:
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

_app_log_handler = AppLogHandler()
_app_log_handler.setLevel(logging.INFO)
logging.getLogger("api").addHandler(_app_log_handler)

_FRONTEND = Path("frontend/build")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(DB_PATH)
    init_log_buffer(LOG_PATH)
    if get_setting("scheduler_enabled", DB_PATH) == "true":
        await start_scheduler()
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(media.router, prefix="/api")
app.include_router(random.router, prefix="/api")
app.include_router(rate.router, prefix="/api")
app.include_router(feed.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(userscript.router, prefix="/api/userscript")


class _SPAFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


if _FRONTEND.exists():
    app.mount("/", _SPAFiles(directory=str(_FRONTEND), html=True), name="static")
