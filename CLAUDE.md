# ResolveKit Backend

This repository is split into runtime services (Python) and control-plane services (Next.js).

## Service Split

- `agent` (FastAPI, Python)
  - Runtime-only SDK/chat API.
  - No dashboard control-plane routes.
- `dashboard` (Next.js)
  - `dash`: dashboard UI.
  - `api`: dashboard `/v1/*` route handlers (control plane).
- `knowledge_bases` (FastAPI, Python)
  - Internal KB ingestion/search service (`/internal/*`).
- `website` (Next.js)
  - Marketing site.

Detailed ownership map: `docs/backend/platform-ownership-split.md`.

## Runtime Endpoints (`agent`)

- `PUT /v1/functions/bulk`
- `GET /v1/functions`
- `GET /v1/functions/eligible`
- `POST /v1/sessions`
- `GET /v1/sessions/{session_id}/localization`
- `GET /v1/sessions/{session_id}/messages`
- `POST /v1/sessions/{session_id}/ws-ticket`
- `WS /v1/sessions/{session_id}/ws`
- `POST /v1/sessions/{session_id}/messages` (SSE)
- `POST /v1/sessions/{session_id}/tool-results`
- `GET /v1/sdk/compat`
- `GET /v1/sdk/chat-theme`

Exact contracts: `docs/generated/openapi/agent.openapi.json`.

## Control-Plane Endpoints (`dashboard` `api`)

Dashboard auth/apps/config/organizations/knowledge-bases/playbooks/functions/audit endpoints are implemented in:

- `dashboard/src/app/v1/**/route.ts`

Exact contracts: `docs/generated/openapi/dashboard.openapi.json`.

## Local Run

```bash
cp .env.example .env
docker compose up --build -d
```

- Dashboard UI: `http://localhost:3000`
- Dashboard API origin: `http://localhost:3002`
- Agent runtime: `http://localhost:8000`
- Agent health: `GET http://localhost:8000/health`

## Key Commands

- `uv run alembic upgrade head`
- `uv run python main.py`
- `uv run python scripts/export_openapi.py`
- `uv run python scripts/check_openapi_sync.py`
- `npm --prefix dashboard run build`
- `uv run python -m pytest`

## Canonical Docs

- `README.md`
- `docs/INDEX.md`
- `docs/backend/services-overview.md`
- `docs/backend/router-map.md`
- `docs/backend/config-env-reference.md`
