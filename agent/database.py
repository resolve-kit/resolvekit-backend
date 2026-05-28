from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from agent.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    # Tune for high-concurrency workloads (10K sessions).
    # Each active turn holds ~1 connection; pool_size should match expected
    # concurrent active turns per worker process. Adjust via env/config if needed.
    pool_size=100,
    max_overflow=50,
    pool_pre_ping=True,   # detect stale connections before use
    pool_recycle=3600,    # recycle connections after 1 hour to avoid idle timeout drops
)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session_factory() as session:
        yield session
