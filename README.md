# ResolveKit Backend

ResolveKit Backend provides the server-side runtime for embedded app assistants. It includes:

- `agent`: runtime API and orchestrator for SDK sessions/chat/tool execution.
- `knowledge_bases`: internal knowledge-base ingestion and semantic search service.
- `dashboard`: Next.js dashboard app (UI + `/v1` control-plane route handlers).
- `website`: Next.js marketing site (Tailwind + shadcn-style components).

## Start Here

1. Local stack (recommended):
   - `docker compose up --build -d`
   - Backend health: `curl -s http://localhost:8000/health`
   - KB service status: `docker compose logs --tail=20 kb-service`
2. Python-only backend:
   - `uv run alembic upgrade head`
   - `uv run python main.py`
3. Production stack:
   - `npm --prefix ../resolvekit-web-sdk run build`
   - `docker compose -f docker-compose.prod.yml --env-file .env up -d --build`
4. Local deploy with Dockerized nginx (non-prod):
   - `cp .env.local-deploy.example .env.local-deploy`
   - configure public DNS + Let's Encrypt values in `.env.local-deploy`
   - `docker compose -f docker-compose.local-deploy.yml --env-file .env --env-file .env.local-deploy up -d --build`

## Documentation Map

- [Documentation Index](docs/INDEX.md)
- [SDK Integration Protocol](SDK_INTEGRATION.md)
- [Service Overview](docs/backend/services-overview.md)
- [Platform Ownership Split](docs/backend/platform-ownership-split.md)
- [iOS App Agent Capabilities](docs/backend/ios-app-agent-capabilities.md)
- [KB Service Capabilities](docs/backend/kb-service-capabilities.md)
- [Router Map](docs/backend/router-map.md)
- [Orchestrator Flow](docs/backend/orchestrator-flow.md)
- [Data Model Map](docs/backend/data-model-map.md)
- [Environment Reference](docs/backend/config-env-reference.md)
- [Error Contracts](docs/backend/error-contracts.md)
- [SDK-to-Backend Integration Map](docs/backend/integration-map-sdk-to-backend.md)
- [Local Dev + Docker Runbook](docs/backend/runbooks/local-dev-and-docker.md)

## OpenAPI Artifacts

Generated snapshots (committed for LLM and developer reference):

- [`dashboard` OpenAPI](docs/generated/openapi/dashboard.openapi.json)
- [`agent` OpenAPI](docs/generated/openapi/agent.openapi.json)
- [`knowledge_bases` OpenAPI](docs/generated/openapi/knowledge_bases.openapi.json)

Regenerate and verify:

- `uv run python scripts/export_openapi.py`
- `uv run python scripts/check_openapi_sync.py`

## LLM Discovery

This repository includes an explicit LLM entrypoint: [`llms.txt`](llms.txt).
