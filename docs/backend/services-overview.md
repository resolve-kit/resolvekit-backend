# Service Overview

## Topology

Playbook backend runtime is split into two FastAPI services plus supporting infrastructure:

- `agent` (`main.py` -> `agent/main.py`)
  - Public API used by dashboard and SDK clients.
  - Owns auth, organizations, apps, config, sessions, chat orchestration, playbooks, and function registry.
- `knowledge_bases` (`knowledge_bases/main.py`)
  - Internal KB ingestion and search service.
  - Owns document crawling, chunking, embeddings, search, and ingestion jobs.
- PostgreSQL databases
  - `db`: primary app database for `agent`.
  - `kb-db`: KB database for `knowledge_bases`.
- `dashboard`
  - React frontend for developer configuration and observability.

Docker composition is defined in [`docker-compose.yml`](../../docker-compose.yml).

## High-Level Boundaries

## `agent`

- API surface:
  - `/v1/auth`, `/v1/organizations`, `/v1/apps`, `/v1/apps/*`, `/v1/functions`, `/v1/sessions`, `/v1/sdk`.
  - Chat transports:
    - WebSocket: `/v1/sessions/{session_id}/ws`
    - SSE fallback: `/v1/sessions/{session_id}/messages`
- Core internals:
  - Orchestrator: [`agent/services/orchestrator.py`](../../agent/services/orchestrator.py)
  - LLM integration: [`agent/services/llm_service.py`](../../agent/services/llm_service.py)
  - KB bridge: [`agent/services/knowledge_bases_client.py`](../../agent/services/knowledge_bases_client.py)

## `knowledge_bases`

- Internal API prefix: `/internal/*` (JWT-protected service-to-service calls).
- Core internals:
  - Router: [`knowledge_bases/router.py`](../../knowledge_bases/router.py)
  - Ingestion: [`knowledge_bases/services/ingestion.py`](../../knowledge_bases/services/ingestion.py)
  - Crawling: [`knowledge_bases/services/crawling.py`](../../knowledge_bases/services/crawling.py)
  - Embeddings/search: [`knowledge_bases/services/embedding.py`](../../knowledge_bases/services/search.py)
  - Worker loop: [`knowledge_bases/services/worker.py`](../../knowledge_bases/services/worker.py)

## Request Flow Patterns

## Dashboard/API management flow

1. Dashboard authenticates developer via JWT endpoints in `agent`.
2. Dashboard manages app-level resources (config, functions, playbooks, KB assignments).
3. `agent` persists primary records in `db`.
4. For KB operations, `agent` proxies to `knowledge_bases` and syncs local KB references.

## Runtime chat flow (SDK)

1. SDK creates session and sends client/session context (`client`, `metadata`, `llm_context`, eligibility fields).
2. SDK opens chat transport (WS preferred, SSE fallback).
3. Orchestrator routes request, enriches prompt with KB/playbook context, calls LLM.
4. Tool calls are dispatched back to SDK; results are returned to orchestrator.
5. Final assistant response is streamed/completed to client and persisted.

See [Orchestrator Flow](orchestrator-flow.md) for detailed turn lifecycle.

## Source-of-Truth Artifacts

- Exact endpoint schemas: [generated OpenAPI](../generated/openapi/agent.openapi.json), [KB OpenAPI](../generated/openapi/knowledge_bases.openapi.json)
- Runtime protocol semantics: [SDK Integration Protocol](../../SDK_INTEGRATION.md)

