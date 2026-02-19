import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ios_app_agent.config import settings
from ios_app_agent.database import async_session_factory
from ios_app_agent.routers import api_keys, apps, auth, chat_http, chat_ws, config, functions, playbooks, sessions
from ios_app_agent.services.session_service import expire_stale_sessions


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
app.include_router(auth.router)

# App management (JWT)
app.include_router(apps.router)
app.include_router(api_keys.router)
app.include_router(config.router)

# Function management
app.include_router(functions.sdk_router)
app.include_router(functions.dashboard_router)

# Playbooks
app.include_router(playbooks.router)

# Sessions
app.include_router(sessions.sdk_router)
app.include_router(sessions.dashboard_router)

# Chat
app.include_router(chat_ws.router)
app.include_router(chat_http.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
