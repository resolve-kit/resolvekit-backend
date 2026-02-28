# Service Overview

## Topology

Playbook is split into four service roles:

- `www` (`website/`, Next.js)
  - Public marketing site.
- `dash` (`dashboard/`, Next.js)
  - Dashboard UI frontend.
- `api` (`dashboard/`, Next.js Route Handlers under `/v1/*`)
  - Dashboard control-plane API boundary.
  - Proxies control-plane requests to internal `agent` routes and sets cookie sessions.
- `agent` (`main.py` -> `agent/main.py`, FastAPI)
  - Runtime API for SDK/chat plus internal control-plane routes.
  - Control-plane routes require `X-Internal-Dashboard-Token` when `IAA_DASHBOARD_INTERNAL_TOKEN` is set.
- `knowledge_bases` (`knowledge_bases/main.py`, FastAPI)
  - Internal KB ingestion and semantic retrieval service.

Supporting infrastructure:

- `db`: primary PostgreSQL for app/runtime/control-plane records.
- `kb-db`: PostgreSQL for KB ingestion/search data.

Docker composition is defined in [`docker-compose.yml`](../../docker-compose.yml).

## Ownership Boundaries

## `agent` ownership

- Public runtime ownership (SDK):
  - `/v1/functions` SDK routes
  - `/v1/sessions` SDK routes
  - `/v1/sdk`
  - `WS /v1/sessions/{session_id}/ws`
  - `POST /v1/sessions/{session_id}/messages`
  - `POST /v1/sessions/{session_id}/tool-results`
- Internal control-plane ownership (called via `api`):
  - `/v1/auth`
  - `/v1/organizations`
  - `/v1/apps/*` management
  - `/v1/knowledge-bases/*`
  - dashboard-specific routes (`functions.dashboard_router`, `sessions.dashboard_router`, `playbooks`, `audit`, `config`, `api-keys`)

## `api` ownership

- External control-plane API origin for dashboard clients.
- Route handlers:
  - attach cookie/session auth to outgoing requests
  - apply internal boundary token (`DASHBOARD_INTERNAL_TOKEN`)
  - proxy to `agent` for current control-plane behavior

## `knowledge_bases` ownership

- Internal API prefix: `/internal/*` (JWT-protected service-to-service calls).
- Owns document ingestion, chunking, embedding generation, and search.

## Primary Flow Patterns

## Dashboard flow

1. Browser app (`dash`) calls `/v1/*` on `api`.
2. `api` route handlers validate/attach session credentials and forward to `agent`.
3. `agent` handles tenant/domain logic and persists to `db`.
4. KB-related calls are proxied from `agent` to `knowledge_bases`.

## SDK runtime flow

1. SDK calls `agent` runtime endpoints directly with app API key.
2. `agent` orchestrator executes LLM + tool loop.
3. Optional KB retrieval is fetched through `knowledge_bases`.
4. Responses stream over WS/SSE back to SDK.

See [Orchestrator Flow](orchestrator-flow.md) for detailed turn lifecycle.
