import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from .config import DB_PATH, ENABLE_ACCESS_LOG
from .db import init_db, set_setting
from .routes import accounts, feed, image, random, rate, settings, stats

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

if not ENABLE_ACCESS_LOG:
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

_FRONTEND = Path("frontend/build")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(DB_PATH)
    set_setting("scheduler_enabled", "false", DB_PATH)
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(image.router, prefix="/api")
app.include_router(random.router, prefix="/api")
app.include_router(rate.router, prefix="/api")
app.include_router(feed.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")


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
