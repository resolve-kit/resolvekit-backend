import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent.config import settings
from agent.database import async_session_factory
from agent.routers import (
    chat_events,
    functions,
    pricing,
    sdk,
    sessions,
)
from agent.services.session_service import expire_stale_sessions
from agent.services.runtime_redis_service import close_redis


def _configure_logging() -> None:
    """Apply timestamped formatter to agent.* loggers after uvicorn has set up its own config."""
    fmt = logging.Formatter(
        fmt="%(asctime)s.%(msecs)03d [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler = logging.StreamHandler()
    handler.setFormatter(fmt)

    agent_logger = logging.getLogger("agent")
    agent_logger.setLevel(logging.INFO)
    # Remove any handlers uvicorn may have propagated; attach our own.
    agent_logger.handlers = [handler]
    agent_logger.propagate = False


def validate_security_config() -> None:
    if settings.debug:
        return
    insecure_values = {"change-me-in-production", ""}
    if settings.jwt_secret in insecure_values:
        raise RuntimeError("RK_JWT_SECRET must be set to a secure non-default value")
    if settings.encryption_key in insecure_values:
        raise RuntimeError("RK_ENCRYPTION_KEY must be set to a secure non-default value")
    if settings.chat_capability_secret is not None and settings.chat_capability_secret in insecure_values:
        raise RuntimeError("RK_CHAT_CAPABILITY_SECRET must be set to a secure non-default value")
    if settings.sdk_client_token_secret is not None and settings.sdk_client_token_secret in insecure_values:
        raise RuntimeError("RK_SDK_CLIENT_TOKEN_SECRET must be set to a secure non-default value")


async def session_expiry_task():
    """Background task to expire stale sessions every 5 minutes."""
    while True:
        try:
            async with async_session_factory() as db:
                await expire_stale_sessions(db)
        except Exception:
            pass
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    validate_security_config()
    task = asyncio.create_task(session_expiry_task())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await close_redis()


app = FastAPI(
    title="ResolveKit Agent Runtime API",
    description="Runtime service for ResolveKit SDK chat, sessions, and function execution",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Function management (SDK)
app.include_router(functions.sdk_router)

# Sessions (SDK)
app.include_router(sessions.sdk_router)

# Chat runtime
app.include_router(chat_events.router)
app.include_router(sdk.router)
app.include_router(pricing.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
