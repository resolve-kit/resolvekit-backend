---
name: resolvekit-backend-setup
description: ResolveKit backend self-hosting and deployment guide. Covers Docker Compose setup, environment configuration, production deployment, knowledge base setup, and control-plane API integration.
category: resolvekit
---

# ResolveKit Backend Setup

## Architecture

| Service | Framework | Purpose |
|---|---|---|
| `agent` | FastAPI (Python 3.13) | SDK session lifecycle, SSE streaming, tool dispatch |
| `knowledge_bases` | FastAPI (Python 3.13) | KB creation, URL crawl/upload, embedding/search |
| `dashboard` | Next.js | Admin UI + `/v1/*` control-plane API route handlers |
| PostgreSQL | -- | Persistent data (two instances: agent + KB) |
| Redis | -- | Session continuity, owner leasing, tool-result handoff |

## Quick Start: Local Development

### Prerequisites
- Python 3.13.x
- Docker + Docker Compose

### Docker Compose (Recommended)
```bash
cd resolvekit-backend
cp .env.example .env
docker compose up -d
```

Default local ports:
| Service | Port |
|---|---|
| Agent API | 8000 |
| KB Service | 8100 |
| Dashboard UI | 3000 |
| Dashboard API | 3002 |
| PostgreSQL (agent) | 15432 |
| PostgreSQL (KB) | 15433 |
| Redis | 16379 |

### Run Services Directly
```bash
# Agent
uv run python -m agent.main

# KB Service
uv run python -m knowledge_bases.main

# Dashboard
cd dashboard && npm run dev
```

### Health Check
```bash
curl http://localhost:8000/health
```

## Step 1: Create App + API Key

1. Open dashboard at `http://localhost:3000`
2. Create an app
3. Generate an API key for SDK usage

SDKs send this key as `Authorization: Bearer <key>`. Keys start with `iaa_`.

## Step 2: Environment Configuration

### Agent Service (IAA_*)
Critical variables:

| Variable | Required | Description |
|---|---|---|
| `IAA_DATABASE_URL` | Yes | Async SQLAlchemy DSN |
| `IAA_REDIS_URL` | Yes | Redis DSN |
| `IAA_JWT_SECRET` | Yes | JWT signing secret |
| `IAA_ENCRYPTION_KEY` | Yes | Fernet key for encrypted data |
| `IAA_CORS_ORIGINS` | No | Allowed origins (comma-separated) |
| `IAA_CHAT_CAPABILITY_SECRET` | Yes | Chat capability token signing |
| `IAA_KNOWLEDGE_BASES_BASE_URL` | Yes | KB service URL |
| `IAA_KNOWLEDGE_BASES_AUDIENCE` | Yes | KB JWT audience |
| `IAA_KNOWLEDGE_BASES_SIGNING_KEY` | Yes | KB JWT signing key |

Optional:
| Variable | Default | Description |
|---|---|---|
| `IAA_MINIMUM_SDK_VERSION` | -- | Enforce minimum SDK version |
| `IAA_SUPPORTED_SDK_MAJOR_VERSIONS` | -- | Supported major versions (e.g., `1,2`) |
| `IAA_CHAT_CAPABILITY_TTL_SECONDS` | 300 | Session token TTL (5 min) |
| `IAA_SESSION_TTL_MINUTES` | 30 | Session expiry |
| `IAA_SDK_CLIENT_TOKEN_SECRET` | -- | Client token signing |
| `IAA_SDK_CLIENT_TOKEN_TTL_SECONDS` | 900 | Client token TTL (15 min) |
| `IAA_INSTANCE_ID` | hostname | Process ID for Redis leasing |

### Knowledge Bases Service (KBS_*)
| Variable | Required | Description |
|---|---|---|
| `KBS_DATABASE_URL` | Yes | KB service DSN |
| `KBS_SERVICE_JWT_SIGNING_KEY` | Yes | Service-to-service auth |
| `KBS_SERVICE_JWT_AUDIENCE` | No | JWT audience |
| `KBS_ENCRYPTION_KEY` | Yes | Encryption for sensitive data |
| `KBS_WORKER_ENABLED` | No | Enable background ingestion worker |

Crawling config: `KBS_CRAWL_*` (timeout, max pages, max depth, user agent, Crawl4AI settings).
Upload config: `KBS_UPLOAD_MAX_FILE_BYTES` (25 MB default), `KBS_UPLOAD_ALLOWED_EXTENSIONS`, `KBS_UPLOAD_OCR_ENABLED`.

### Dashboard
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Browser-facing API URL |
| `DATABASE_URL` | Yes | Prisma DSN |
| `RESOLVEKIT_SERVER_AGENT_BASE_URL` | No | Server-only agent URL for lookups |

Reference files in the backend repo:
- `.env.example` -- Local defaults
- `.env.local-deploy.example` -- Single-host quickstart (path prefix `/agent`)
- `.env.prod.example` -- Split-host production topology

## Step 3: Production Deployment

### Single-Host Quickstart
Uses `.env.local-deploy.example`. Dashboard and agent share the same host with `/agent` path prefix. Suitable for quick deployments.

### Split-Host Production
Uses `.env.prod.example`. Separate hosts for:
- Agent API (`api.example.com`)
- Dashboard (`dashboard.example.com`)
- KB service (internal)

CRITICAL for production:
- Generate strong `IAA_JWT_SECRET`
- Generate valid Fernet `IAA_ENCRYPTION_KEY`
- Generate strong `KBS_SERVICE_JWT_SIGNING_KEY` and `KBS_ENCRYPTION_KEY`
- Agent validates critical secrets at startup when `IAA_DEBUG` is off

## Step 4: Knowledge Base Setup

KB service endpoints are under `/internal/*` and called by control-plane routes.

### KB Operations
- Create/list/get/update/delete KBs
- Source ingestion: URL crawl, file upload, recrawl, source deletion
- Search: single KB and multi-KB search
- Embedding profiles: CRUD + impact checks
- Jobs/documents: listing + deletion
- Usage: aggregate summaries

### Adding Knowledge Sources
1. Create a KB via dashboard or API
2. Add sources:
   - URL crawl: provide a URL, crawler ingests pages
   - File upload: upload PDFs, docs, markdown, etc.
   - Supported formats: `.txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.rtf,.odt,.html,.htm,.csv,.tsv,.xlsx,.xls,.json,.xml,.yaml,.yml`
3. Monitor ingestion jobs
4. Test search to verify indexing

## API Reference Summary

### Agent Runtime API
| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/sdk/compat` | GET | SDK version compatibility check |
| `/v1/sdk/chat-theme` | GET | Fetch chat theme for app |
| `/v1/functions/bulk` | PUT | Register SDK functions |
| `/v1/sessions` | POST | Create/reuse session |
| `/v1/sessions/{id}/events` | GET (SSE) | Event stream |
| `/v1/sessions/{id}/messages` | POST | Send user message |
| `/v1/sessions/{id}/tool-results` | POST | Submit tool result |
| `/v1/sessions/{id}/context` | PATCH | Update session context |
| `/v1/sessions/{id}/messages` | GET | Message history |
| `/v1/sessions/{id}/localization` | GET | Localized UI strings |
| `/health` | GET | Health check |

### Auth Model
- Primary: `Authorization: Bearer <api_key_or_client_token>`
- Session-scoped: `X-Resolvekit-Chat-Capability: <token>`

### Session Flow
1. SDK checks compatibility: `GET /v1/sdk/compat`
2. SDK fetches theme: `GET /v1/sdk/chat-theme`
3. SDK syncs functions: `PUT /v1/functions/bulk`
4. SDK creates session: `POST /v1/sessions` (returns `chat_capability_token`)
5. SDK opens SSE stream: `GET /v1/sessions/{id}/events`
6. SDK posts messages: `POST /v1/sessions/{id}/messages`
7. SDK returns tool results: `POST /v1/sessions/{id}/tool-results`

### OpenAPI Specs
Generated specs in backend repo:
- `docs/generated/openapi/agent.openapi.json`
- `docs/generated/openapi/dashboard.openapi.json`
- `docs/generated/openapi/knowledge_bases.openapi.json`

## Pitfalls

1. **Production secrets**: Agent refuses to start without valid `IAA_JWT_SECRET`, `IAA_ENCRYPTION_KEY`, and `IAA_CHAT_CAPABILITY_SECRET` when debug is off.
2. **Fernet key**: `IAA_ENCRYPTION_KEY` must be a valid Fernet key. Use `cryptography.fernet.Fernet.generate_key()`.
3. **CORS**: Set `IAA_CORS_ORIGINS` to match your dashboard and SDK origins.
4. **KB service connectivity**: Agent needs `IAA_KNOWLEDGE_BASES_BASE_URL` pointing to a reachable KB service.
5. **Redis required**: Agent requires Redis for session continuity. Without it, sessions cannot coordinate across workers.
6. **Session TTL**: Default 30 minutes. Configure `IAA_SESSION_TTL_MINUTES` for your use case.
7. **Dashboard API boundary**: In Docker, dashboard uses `RESOLVEKIT_SERVER_AGENT_BASE_URL` for server-side agent lookups. This can point to `http://backend:8000` internally.
8. **Single-host vs split-host**: Local deploy uses path prefix (`/agent`), production uses separate hosts. Match your deployment topology to the correct env file.
