import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent.config import settings
from agent.database import async_session_factory
from agent.middleware.dashboard_internal import require_dashboard_internal_token
from agent.routers import (
    api_keys,
    apps,
    audit,
    auth,
    chat_http,
    chat_ws,
    config,
    functions,
    knowledge_bases,
    organizations,
    playbooks,
    sdk,
    sessions,
)
from agent.services.session_service import expire_stale_sessions

dashboard_internal_dependency = [Depends(require_dashboard_internal_token)]


def validate_security_config() -> None:
    if settings.debug:
        return
    insecure_values = {"change-me-in-production", ""}
    if settings.jwt_secret in insecure_values:
        raise RuntimeError("IAA_JWT_SECRET must be set to a secure non-default value")
    if settings.encryption_key in insecure_values:
        raise RuntimeError("IAA_ENCRYPTION_KEY must be set to a secure non-default value")
    if settings.chat_capability_secret is not None and settings.chat_capability_secret in insecure_values:
        raise RuntimeError("IAA_CHAT_CAPABILITY_SECRET must be set to a secure non-default value")


async def session_expiry_task():
    """Background task to expire stale sessions every 5 minutes."""
    while True:
        try:
            async with async_session_factory() as db:
                await expire_stale_sessions(db, ttl_minutes=60)
        except Exception:
            pass
        await asyncio.sleep(300)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_security_config()
    task = asyncio.create_task(session_expiry_task())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="iOS App Agent",
    description="Backend service for iOS App Agent SDK",
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

# Auth & developer
app.include_router(auth.router, dependencies=dashboard_internal_dependency)
app.include_router(organizations.router, dependencies=dashboard_internal_dependency)

# App management (JWT)
app.include_router(apps.router, dependencies=dashboard_internal_dependency)
app.include_router(api_keys.router, dependencies=dashboard_internal_dependency)
app.include_router(config.router, dependencies=dashboard_internal_dependency)
app.include_router(audit.router, dependencies=dashboard_internal_dependency)
app.include_router(knowledge_bases.router, dependencies=dashboard_internal_dependency)

# Function management
app.include_router(functions.sdk_router)
app.include_router(functions.dashboard_router, dependencies=dashboard_internal_dependency)

# Playbooks
app.include_router(playbooks.router, dependencies=dashboard_internal_dependency)

# Sessions
app.include_router(sessions.sdk_router)
app.include_router(sessions.dashboard_router, dependencies=dashboard_internal_dependency)

# Chat
app.include_router(chat_ws.router)
app.include_router(chat_http.router)
app.include_router(sdk.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
