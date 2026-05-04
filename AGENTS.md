# resolvekit-backend

Open-source AI agent orchestration for in-app support.

## Working Contract

- Humans define intent and quality bars.
- Agents implement code, tests, docs, and CI changes.
- Repository markdown is the source of truth for architecture and process.
- Behavior changes must include docs updates in the same PR.

## Project Overview

ResolveKit Backend runs the AI agent that resolves user issues inside mobile apps. It provides agent orchestration, knowledge base management, and an admin dashboard for self-hosted deployments.

**Tech Stack**: Python 3.13, FastAPI, PostgreSQL, Redis, Next.js (dashboard)

**Architecture**:
- Agent service (`agent/`) — FastAPI service for chat orchestration and tool dispatch
- KB service (`knowledge_bases/`) — document ingestion, embedding, and search
- Dashboard (`dashboard/`) — Next.js admin UI
- Caddy reverse proxy (`infra/`) — TLS termination and routing

## First Read

1. [README.md](README.md) for package integration and runtime model.
2. [docs/INDEX.md](docs/INDEX.md) for repository knowledge map.
3. [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Commands

```bash
# Start all services (local build)
docker compose up -d

# Start all services (prebuilt images, no local build)
docker compose -f docker-compose.prebuilt.yml pull
docker compose -f docker-compose.prebuilt.yml up -d

# Run agent service directly
uv run python -m agent.main

# Run KB service directly
uv run python -m knowledge_bases.main

# Run dashboard
cd dashboard && npm run dev

# Run tests
uv run pytest

# Run tests in Docker
docker compose run backend pytest

# Database migrations
uv run alembic upgrade head
```

## Source Layout

- [agent/](agent/) — FastAPI agent service (chat orchestration, tool dispatch, SSE streams)
- [knowledge_bases/](knowledge_bases/) — KB service (document ingestion, embedding, search)
- [dashboard/](dashboard/) — Next.js admin dashboard
- [alembic/](alembic/) — Database migrations
- [infra/](infra/) — Caddy reverse proxy configuration
- [deploy/](deploy/) — Docker Compose configs (local, prod, prebuilt)
- [docs/](docs/) — Backend documentation
- [tests/](tests/) — Test suite
- [scripts/](scripts/) — Utility scripts

## Guardrails

- No secrets or private credentials in repo.
- Preserve public API compatibility unless explicitly planned.
- Keep defaults self-host-friendly and documented.
- Always use parameterized queries for SQL.
- Validate all user input at service boundaries.

## Links

- Homepage: https://github.com/resolve-kit/resolvekit-backend
- Issues: https://github.com/resolve-kit/resolvekit-backend/issues
- Documentation: https://github.com/resolve-kit/resolvekit-backend/tree/main/docs
