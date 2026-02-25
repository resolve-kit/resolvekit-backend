# Service Overview

## Topology

Playbook backend runtime is split into two FastAPI services plus supporting infrastructure:

- `ios_app_agent` (`main.py` -> `ios_app_agent/main.py`)
  - Public API used by dashboard and SDK clients.
  - Owns auth, organizations, apps, config, sessions, chat orchestration, playbooks, and function registry.
- `kb_service` (`kb_service/main.py`)
  - Internal KB ingestion and search service.
  - Owns document crawling, chunking, embeddings, search, and ingestion jobs.
- PostgreSQL databases
  - `db`: primary app database for `ios_app_agent`.
  - `kb-db`: KB database for `kb_service`.
- `dashboard`
  - React frontend for developer configuration and observability.

Docker composition is defined in [`docker-compose.yml`](../../docker-compose.yml).

## High-Level Boundaries

## `ios_app_agent`

- API surface:
  - `/v1/auth`, `/v1/organizations`, `/v1/apps`, `/v1/apps/*`, `/v1/functions`, `/v1/sessions`, `/v1/sdk`.
  - Chat transports:
    - WebSocket: `/v1/sessions/{session_id}/ws`
    - SSE fallback: `/v1/sessions/{session_id}/messages`
- Core internals:
  - Orchestrator: [`ios_app_agent/services/orchestrator.py`](../../ios_app_agent/services/orchestrator.py)
  - LLM integration: [`ios_app_agent/services/llm_service.py`](../../ios_app_agent/services/llm_service.py)
  - KB bridge: [`ios_app_agent/services/kb_service_client.py`](../../ios_app_agent/services/kb_service_client.py)

## `kb_service`

- Internal API prefix: `/internal/*` (JWT-protected service-to-service calls).
- Core internals:
  - Router: [`kb_service/router.py`](../../kb_service/router.py)
  - Ingestion: [`kb_service/services/ingestion.py`](../../kb_service/services/ingestion.py)
  - Crawling: [`kb_service/services/crawling.py`](../../kb_service/services/crawling.py)
  - Embeddings/search: [`kb_service/services/embedding.py`](../../kb_service/services/search.py)
  - Worker loop: [`kb_service/services/worker.py`](../../kb_service/services/worker.py)

## Request Flow Patterns

## Dashboard/API management flow

1. Dashboard authenticates developer via JWT endpoints in `ios_app_agent`.
2. Dashboard manages app-level resources (config, functions, playbooks, KB assignments).
3. `ios_app_agent` persists primary records in `db`.
4. For KB operations, `ios_app_agent` proxies to `kb_service` and syncs local KB references.

## Runtime chat flow (SDK)

1. SDK creates session and sends client/session context (`client`, `metadata`, `llm_context`, eligibility fields).
2. SDK opens chat transport (WS preferred, SSE fallback).
3. Orchestrator routes request, enriches prompt with KB/playbook context, calls LLM.
4. Tool calls are dispatched back to SDK; results are returned to orchestrator.
5. Final assistant response is streamed/completed to client and persisted.

See [Orchestrator Flow](orchestrator-flow.md) for detailed turn lifecycle.

## Source-of-Truth Artifacts

- Exact endpoint schemas: [generated OpenAPI](../generated/openapi/ios_app_agent.openapi.json), [KB OpenAPI](../generated/openapi/kb_service.openapi.json)
- Runtime protocol semantics: [SDK Integration Protocol](../../SDK_INTEGRATION.md)

