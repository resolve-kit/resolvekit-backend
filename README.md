# Playbook Backend

Playbook Backend provides the server-side runtime for embedded app assistants. It includes:

- `ios_app_agent`: primary API and orchestrator for sessions, chat, tool execution, config, and governance.
- `kb_service`: internal knowledge-base ingestion and semantic search service.
- `dashboard`: web UI for developers to configure assistant behavior.

## Start Here

1. Local stack (recommended):
   - `docker compose up --build -d`
   - Backend health: `curl -s http://localhost:8000/health`
   - KB service status: `docker compose logs --tail=20 kb-service`
2. Python-only backend:
   - `uv run alembic upgrade head`
   - `uv run python main.py`

## Documentation Map

- [Documentation Index](docs/INDEX.md)
- [SDK Integration Protocol](SDK_INTEGRATION.md)
- [Service Overview](docs/backend/services-overview.md)
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

- [`ios_app_agent` OpenAPI](docs/generated/openapi/ios_app_agent.openapi.json)
- [`kb_service` OpenAPI](docs/generated/openapi/kb_service.openapi.json)

Regenerate and verify:

- `uv run python scripts/export_openapi.py`
- `uv run python scripts/check_openapi_sync.py`

## LLM Discovery

This repository includes an explicit LLM entrypoint: [`llms.txt`](llms.txt).
