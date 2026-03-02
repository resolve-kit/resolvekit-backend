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


async def _ensure_kb_summary_columns(conn) -> None:  # noqa: ANN001
    await conn.execute(
        text(
            """
            ALTER TABLE knowledge_bases
            ADD COLUMN IF NOT EXISTS summary_llm_profile_id UUID,
            ADD COLUMN IF NOT EXISTS summary_llm_profile_name VARCHAR(120),
            ADD COLUMN IF NOT EXISTS summary_provider VARCHAR(64),
            ADD COLUMN IF NOT EXISTS summary_model VARCHAR(128),
            ADD COLUMN IF NOT EXISTS summary_api_key_encrypted TEXT,
            ADD COLUMN IF NOT EXISTS summary_api_base VARCHAR(255),
            ADD COLUMN IF NOT EXISTS summary_text TEXT,
            ADD COLUMN IF NOT EXISTS summary_topics_json JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS summary_status VARCHAR(32) DEFAULT 'disabled',
            ADD COLUMN IF NOT EXISTS summary_last_error TEXT,
            ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS summary_content_fingerprint VARCHAR(64);
            """
        )
    )
    await conn.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_knowledge_bases_summary_content_fingerprint
            ON knowledge_bases (summary_content_fingerprint);
            """
        )
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_kb_search_indexes(conn)
        await _ensure_kb_summary_columns(conn)

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
    title="ResolveKit KB Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
