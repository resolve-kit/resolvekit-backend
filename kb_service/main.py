import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from kb_service.config import settings
from kb_service.database import engine
from kb_service.models import Base
from kb_service.router import router
from kb_service.services.worker import worker_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    task = None
    if settings.worker_enabled:
        task = asyncio.create_task(worker_loop())

    yield

    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Playbook KB Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}

