# iOS App Agent

Backend service + developer dashboard for the iOS App Agent SDK. iOS app developers integrate a Swift SDK that registers locally-callable functions; a backend-hosted LLM agent orchestrates which functions to call on-device based on natural language chat.

## Quick Start

```bash
cp .env.example .env
# Edit .env — set IAA_JWT_SECRET and IAA_ENCRYPTION_KEY (see below)
docker compose up --build
```

- **Dashboard:** http://localhost:3000
- **API docs:** http://localhost:8000/docs
- **Backend:** http://localhost:8000

### Generate secrets for .env

```bash
# JWT secret
openssl rand -hex 32

# Fernet encryption key (for LLM API keys at rest)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐
│  Dashboard   │───▶│   Backend   │───▶│  PostgreSQL  │
│  (React SPA) │    │  (FastAPI)  │    │              │
│  port 3000   │    │  port 8000  │    │  port 5432   │
└─────────────┘    └──────┬──────┘    └──────────────┘
                          │
                    ┌─────▼─────┐
                    │  LiteLLM  │──▶ OpenAI / Anthropic / Google
                    └───────────┘
```

### Core flow

1. iOS SDK registers functions → `PUT /v1/functions/bulk`
2. Developer configures agent (model, prompt, keys) via dashboard
3. End user chats → SDK opens WebSocket to `/v1/sessions/{id}/ws`
4. Backend calls LLM with tools → LLM decides function calls → sends `tool_call_request` to iOS
5. iOS executes function locally → sends `tool_result` back
6. Backend feeds results to LLM → streams response to iOS → `turn_complete`

## Project Structure

```
ios_app_agent/          # Python package (FastAPI backend)
  main.py               # App factory, router mounting, lifespan
  config.py             # pydantic-settings (IAA_ env prefix)
  database.py           # Async SQLAlchemy engine + session factory
  models/               # SQLAlchemy ORM models (8 tables)
  schemas/              # Pydantic request/response models
  routers/              # API endpoints (auth, apps, config, functions, sessions, chat_ws, chat_http)
  services/             # Business logic (orchestrator, llm_service, session_service)
  middleware/            # JWT + API key auth
alembic/                # Database migrations
dashboard/              # React + Vite + TypeScript + Tailwind SPA
  src/pages/            # Login, Apps, AppConfig, Functions, Sessions, ApiKeys
  src/api/client.ts     # Fetch wrapper with JWT
tests/                  # Test directory
```

## Development (without Docker)

### Backend

```bash
uv sync
# Start PostgreSQL locally, then:
export IAA_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/ios_app_agent
export IAA_JWT_SECRET=$(openssl rand -hex 32)
export IAA_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
uv run alembic upgrade head
uv run python main.py
```

### Dashboard

```bash
cd dashboard
npm install
npm run dev    # http://localhost:5173, proxies /v1 to backend
```

## Key Commands

| Command | Description |
|---------|-------------|
| `docker compose up --build` | Start everything (DB + backend + dashboard) |
| `docker compose down -v` | Stop and remove volumes (wipes DB) |
| `docker compose logs -f backend` | Tail backend logs |
| `uv run alembic upgrade head` | Run DB migrations |
| `uv run alembic revision --autogenerate -m "msg"` | Generate new migration |
| `uv run python main.py` | Start backend in dev mode (reload) |
| `npm run dev` (in dashboard/) | Start dashboard dev server |
| `npm run build` (in dashboard/) | Build dashboard for production |

## Environment Variables

All backend settings use the `IAA_` prefix (set in `.env` or shell):

| Variable | Required | Description |
|----------|----------|-------------|
| `IAA_DATABASE_URL` | Yes | PostgreSQL asyncpg connection string |
| `IAA_JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `IAA_ENCRYPTION_KEY` | Yes | Fernet key for encrypting LLM API keys at rest |
| `IAA_CORS_ORIGINS` | No | JSON array of allowed origins (default: `["http://localhost:5173"]`) |
| `IAA_JWT_EXPIRE_MINUTES` | No | JWT token lifetime (default: 1440 = 24h) |
| `IAA_DEBUG` | No | Enable SQLAlchemy echo (default: false) |
| `POSTGRES_USER` | Docker | PostgreSQL user (default: ios_app_agent) |
| `POSTGRES_PASSWORD` | Docker | PostgreSQL password (default: postgres) |
| `POSTGRES_DB` | Docker | PostgreSQL database name (default: ios_app_agent) |

## API Overview

### Auth (JWT — developer dashboard)
- `POST /v1/auth/signup` — Create developer account
- `POST /v1/auth/login` — Get JWT token
- `GET /v1/auth/me` — Current developer profile

### Apps (JWT)
- `POST/GET /v1/apps` — Create / list apps
- `GET/PATCH/DELETE /v1/apps/{app_id}` — App CRUD

### API Keys (JWT)
- `POST/GET /v1/apps/{app_id}/api-keys` — Generate / list keys
- `DELETE /v1/apps/{app_id}/api-keys/{key_id}` — Revoke key

### Agent Config (JWT)
- `GET/PUT /v1/apps/{app_id}/config` — Get / update agent configuration

### Functions — SDK (API key auth)
- `PUT /v1/functions/bulk` — Bulk register/sync functions
- `GET /v1/functions` — List active functions

### Functions — Dashboard (JWT)
- `GET /v1/apps/{app_id}/functions` — List all functions
- `PATCH /v1/apps/{app_id}/functions/{id}` — Edit function
- `DELETE /v1/apps/{app_id}/functions/{id}` — Deactivate function

### Chat — SDK (API key auth)
- `POST /v1/sessions` — Create session (returns ws_url)
- `WebSocket /v1/sessions/{id}/ws` — Primary chat channel
- `POST /v1/sessions/{id}/messages` — HTTP SSE fallback
- `POST /v1/sessions/{id}/tool-results` — Submit tool results (SSE mode)

### Sessions — Dashboard (JWT)
- `GET /v1/apps/{app_id}/sessions` — List sessions
- `GET /v1/apps/{app_id}/sessions/{id}/messages` — View message history

## WebSocket Protocol

Envelope: `{type, request_id, payload, timestamp}`

**Client → Server:** `chat_message`, `tool_result`, `ping`
**Server → Client:** `assistant_text_delta`, `tool_call_request`, `turn_complete`, `error`, `pong`

## Data Models

- **DeveloperAccount** — email, name, hashed_password
- **App** — belongs to developer, has name + bundle_id
- **ApiKey** — SHA-256 hashed, prefixed `iaa_`, scoped to app
- **AgentConfig** — one per app: system_prompt, llm_provider/model, encrypted API key, temperature, limits
- **RegisteredFunction** — name, description, JSON Schema params, timeout, scoped to app
- **ChatSession** — app + device_id, status (active/expired/closed), metadata
- **Message** — role, content, tool_calls (JSONB), sequence_number

## Auth Model

- **Dashboard (JWT):** Developer signup/login → JWT bearer token → all `/v1/apps/...` endpoints
- **SDK (API key):** `iaa_` prefixed keys → SHA-256 hashed in DB → `Authorization: Bearer iaa_...` → `/v1/functions`, `/v1/sessions`
- **WebSocket:** API key passed as `?api_key=` query parameter

## Conventions

- Python: async everywhere, SQLAlchemy 2.0 style, Pydantic v2 schemas
- TypeScript: functional React components, Tailwind utility classes
- API versioning: `/v1/` prefix on all routes
- IDs: UUIDs throughout
- Env config: `IAA_` prefix, pydantic-settings
