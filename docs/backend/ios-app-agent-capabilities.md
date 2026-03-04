# iOS App Agent Capabilities

This document maps runtime capabilities to concrete implementation modules in `agent`.

## Entry Point

- App bootstrap: [`agent/main.py`](../../agent/main.py)
- Health: `GET /health`

## Capability Areas

`agent` is runtime-only. Dashboard control-plane features (auth/apps/config/orgs/KB/admin) are owned by Next route handlers in `dashboard/src/app/v1/**`.

## Function Registry and Eligibility

- Router:
  - [`agent/routers/functions.py`](../../agent/routers/functions.py)
- Models/services:
  - [`agent/models/function_registry.py`](../../agent/models/function_registry.py)
  - [`agent/services/function_service.py`](../../agent/services/function_service.py)
  - [`agent/services/compatibility_service.py`](../../agent/services/compatibility_service.py)
- Key features:
  - Bulk function sync from SDK.
  - Runtime filtering by platform/version and session function allowlist.

ResolveKit records are read by runtime for prompt enrichment, but CRUD ownership is in dashboard `api`.

## Session Management and Context Ingestion

- Router:
  - [`agent/routers/sessions.py`](../../agent/routers/sessions.py)
- Model:
  - [`agent/models/session.py`](../../agent/models/session.py)
- Key features:
  - Session creation and ws-ticket issuance.
  - Per-session context fields:
    - `client_context`
    - `llm_context`
    - `available_function_names`
  - Dashboard session/message listing.

## Chat Runtime Transports

- Routers:
  - [`agent/routers/chat_ws.py`](../../agent/routers/chat_ws.py)
  - [`agent/routers/chat_http.py`](../../agent/routers/chat_http.py)
- Key features:
  - WS envelope protocol (stream deltas, tool calls, tool results, turn completion, errors).
  - SSE fallback for environments without stable WS transport.
  - Capability-token gating and chat availability checks.

## Orchestration and LLM Runtime

- Core module:
  - [`agent/services/orchestrator.py`](../../agent/services/orchestrator.py)
- Supporting modules:
  - [`agent/services/llm_service.py`](../../agent/services/llm_service.py)
  - [`agent/services/chat_access_service.py`](../../agent/services/chat_access_service.py)
- Key features:
  - Router + enriched context architecture.
  - Scope mode enforcement (`open`/`strict`).
  - KB prefetch and fallback `kb_search` tool flow.
  - ResolveKit prompt enrichment.
  - Multi-round tool loop, usage tracking, message persistence.

## Knowledge Base Bridge

- Bridge client:
  - [`agent/services/knowledge_bases_client.py`](../../agent/services/knowledge_bases_client.py)
- Local models:
  - [`agent/models/knowledge_base_ref.py`](../../agent/models/knowledge_base_ref.py)
  - [`agent/models/app_knowledge_base.py`](../../agent/models/app_knowledge_base.py)
- Key features:
  - Runtime retrieval for app-assigned KBs during chat orchestration.
  - Service-to-service JWT auth for KB calls.
  - KB CRUD/admin flows are owned by dashboard `api`.

## SDK Compatibility and Guardrails

- Router:
  - [`agent/routers/sdk.py`](../../agent/routers/sdk.py)
- Config:
  - [`agent/config.py`](../../agent/config.py)
- Key features:
  - Declares minimum and supported SDK major versions.
  - Exposes required client fields for runtime context.

## Related Docs

- [Router Map](router-map.md)
- [Orchestrator Flow](orchestrator-flow.md)
- [SDK-to-Backend Integration Map](integration-map-sdk-to-backend.md)
- [OpenAPI Contract](../generated/openapi/agent.openapi.json)
