# ResolveKit Backend

[![CI](https://github.com/resolve-kit/resolvekit-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/resolve-kit/resolvekit-backend/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-AGPL--3.0-orange.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docs.docker.com/compose/)

Open-source backend runtime and dashboard for self-hosted ResolveKit agent orchestration.

**Support is moving into the product. ResolveKit is where it lands.**

## What It Does

ResolveKit Backend runs the AI agent that resolves user issues inside mobile apps. It:

- **Orchestrates chat sessions** — manages conversation state, turn processing, and tool dispatch
- **Runs AI agents** — connects to LLM providers (OpenAI, Anthropic, self-hosted) for natural language understanding
- **Handles tool calls** — dispatches function calls to iOS/Android SDKs and collects results
- **Manages knowledge bases** — crawls, indexes, and searches your app's documentation
- **Provides an admin dashboard** — configure apps, monitor sessions, manage functions
- **Exposes APIs** — REST and WebSocket endpoints for SDK integration

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   iOS SDK       │────▶│                  │────▶│   Agent Service   │
│   (Swift)       │     │                  │     │   (FastAPI)       │
└─────────────────┘     │   Caddy/Reverse  │     └────────┬─────────┘
                        │   Proxy          │              │
┌─────────────────┐     │                  │     ┌────────▼─────────┐
│   Android SDK   │────▶│                  │────▶│   KB Service      │
│   (Kotlin)      │     │                  │     │   (FastAPI)       │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                 │                        │
                        ┌────────▼─────────┐     ┌────────▼─────────┐
                        │   Dashboard       │     │   PostgreSQL      │
                        │   (Next.js)       │     │   (Sessions, KB)  │
                        └──────────────────┘     └──────────────────┘
                                                   ┌──────────────────┐
                                                   │   Redis           │
                                                   │   (Cache, State)  │
                                                   └──────────────────┘
```

## Quick Start

### Prerequisites

- Docker + Docker Compose
- An LLM API key (OpenAI, Anthropic, or self-hosted)
- PostgreSQL (included in Docker Compose)

### 1. Clone and Configure

```bash
git clone https://github.com/resolve-kit/resolvekit-backend.git
cd resolvekit-backend
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your settings:

```bash
# Required
OPENAI_API_KEY=sk-...                    # Your LLM API key
DATABASE_URL=postgresql+asyncpg://...    # PostgreSQL connection string
IAA_JWT_SECRET=your-secret-key           # For dashboard auth tokens
IAA_ENCRYPTION_KEY=your-fernet-key       # For encrypting provider secrets

# Optional
RESOLVEKIT_AGENT_BASE_URL=https://agent.yourdomain.com  # Public URL
IAA_KNOWLEDGE_BASES_BASE_URL=http://kb:8001             # Internal KB service URL
```

### 3. Start Services

```bash
docker compose up -d
```

This starts:
- **Agent service** (port 8000) — FastAPI with WebSocket support
- **Knowledge bases service** (port 8001) — Document ingestion and search
- **Dashboard** (port 3000) — Next.js admin UI
- **PostgreSQL** (port 5432) — Database
- **Redis** (port 6379) — Cache and session state

### 4. Verify

```bash
# Health check
curl http://localhost:8000/health

# Dashboard
open http://localhost:3000
```

## Self-Hosting Guide

### Production Deployment

For production, use `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml up -d
```

This includes:
- Caddy reverse proxy with automatic HTTPS
- Production-optimized settings
- Health check endpoints

### Local Development

```bash
docker compose -f docker-compose.yml up -d
```

Or run services individually:

```bash
# Agent only
uv run python -m agent.main

# KB service only
uv run python -m knowledge_bases.main

# Dashboard only
cd dashboard && npm run dev
```

### Database Migrations

```bash
uv run alembic upgrade head
```

## API Overview

### SDK Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/sdk/sessions` | Create a new chat session |
| `WS` | `/sdk/sessions/{id}/events` | WebSocket event stream |
| `POST` | `/sdk/sessions/{id}/tool-results` | Submit tool call results |
| `GET` | `/sdk/sessions/{id}/history` | Get session message history |

### Dashboard API

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/v1/apps` | Create an app |
| `GET` | `/v1/apps` | List all apps |
| `POST` | `/v1/apps/{id}/config` | Update app configuration |
| `GET` | `/v1/apps/{id}/sessions` | List sessions for an app |
| `POST` | `/v1/knowledge-bases` | Create a knowledge base |
| `GET` | `/v1/knowledge-bases/{id}/search` | Search knowledge base |

Full OpenAPI specs are available at:
- Agent API: `/docs/generated/openapi/agent.openapi.json`
- Dashboard API: `/docs/generated/openapi/dashboard.openapi.json`
- KB API: `/docs/generated/openapi/knowledge_bases.openapi.json`

## Environment Variables

### Agent Service

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes* | OpenAI API key (or other LLM provider) |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `IAA_JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `IAA_ENCRYPTION_KEY` | Yes | Fernet key for encrypting secrets |

### Knowledge Bases Service

| Variable | Required | Description |
| --- | --- | --- |
| `IAA_KNOWLEDGE_BASES_BASE_URL` | Yes | Internal service URL |
| `IAA_KNOWLEDGE_BASES_AUDIENCE` | Yes | JWT audience for KB auth |
| `EMBEDDING_MODEL` | No | Embedding model to use |

### Dashboard

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Browser-facing API URL |
| `RESOLVEKIT_SERVER_AGENT_BASE_URL` | No | Server-only agent URL |
| `DATABASE_URL` | Yes | Prisma connection string |
| `IAA_JWT_SECRET` | Yes | Dashboard session tokens |
| `IAA_ENCRYPTION_KEY` | Yes | Provider secret encryption |

## Health Checks

| Service | Endpoint | Success Response |
| --- | --- | --- |
| Agent | `GET /health` | `{"status": "ok"}` |
| KB Service | `GET /health` | `{"status": "ok"}` |
| Dashboard | `GET /api/health` | `{"status": "ok"}` |
| PostgreSQL | `pg_isready` | `accepting connections` |
| Redis | `redis-cli ping` | `PONG` |

## Troubleshooting

### Agent fails to start
- Check `DATABASE_URL` points to a running PostgreSQL instance
- Verify `REDIS_URL` is accessible
- Ensure LLM API key is valid

### Dashboard shows "Connection refused"
- Verify `NEXT_PUBLIC_API_BASE_URL` points to the correct backend URL
- Check CORS settings: `IAA_CORS_ALLOWED_ORIGINS` must include your dashboard origin
- Ensure the agent service is running and accessible

### Knowledge base crawling fails
- Verify `IAA_KNOWLEDGE_BASES_BASE_URL` is correct
- Check that the target URLs are publicly accessible
- Review KB service logs for detailed errors

### WebSocket connections drop
- Ensure your reverse proxy supports WebSocket upgrades
- Check that the session ticket hasn't expired
- Verify the SDK is sending valid authentication

## Backup and Restore

### Backup

```bash
# Database
docker compose exec db pg_dump -U postgres resolvekit > backup.sql

# Knowledge base indices
docker compose exec kb tar czf /tmp/kb-backup.tar.gz /data/kb
```

### Restore

```bash
# Database
cat backup.sql | docker compose exec -T db psql -U postgres resolvekit
```

## Upgrading

When upgrading to a new version:

1. Pull the latest code: `git pull`
2. Review `.env.example` for new environment variables
3. Run database migrations: `uv run alembic upgrade head`
4. Restart services: `docker compose up -d`

## Documentation

- [Backend docs index](docs/INDEX.md)
- [Config reference](docs/backend/config-env-reference.md)
- [Data model map](docs/backend/data-model-map.md)
- [Orchestrator flow](docs/backend/orchestrator-flow.md)
- [SDK capabilities](docs/backend/sdk-capabilities-reference.md)
- [Error contracts](docs/backend/error-contracts.md)
- [Local dev guide](docs/backend/runbooks/local-dev-and-docker.md)

## Repository Structure

| Directory | Purpose |
| --- | --- |
| `agent/` | FastAPI agent service (chat orchestration, tool dispatch) |
| `knowledge_bases/` | Document ingestion, embedding, search service |
| `dashboard/` | Next.js admin dashboard + API routes |
| `alembic/` | Database migrations |
| `deploy/` | Docker Compose configs for local/prod |
| `infra/` | Caddy reverse proxy configuration |
| `docs/` | Backend documentation |
| `scripts/` | Utility scripts (OpenAPI export, etc.) |
| `tests/` | Test suite (60+ test files) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the AGPL-3.0 License. See [LICENSE](LICENSE) for details.
