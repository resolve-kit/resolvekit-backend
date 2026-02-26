import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from knowledge_bases.config import settings
from knowledge_bases.database import engine
from knowledge_bases.models import Base
from knowledge_bases.router import router
from knowledge_bases.services.worker import worker_loop


async def _ensure_kb_search_indexes(conn) -> None:  # noqa: ANN001
    await conn.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_content_tsv_english
            ON knowledge_chunks
            USING GIN (to_tsvector('english', content_text));
            """
        )
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_kb_search_indexes(conn)

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
