# iOS App Agent Capabilities

This document maps functional capabilities to concrete implementation modules in `agent`.

## Entry Point

- App bootstrap: [`agent/main.py`](../../agent/main.py)
- Health: `GET /health`

## Capability Areas

## Authentication and Identity

- Routers:
  - [`agent/routers/auth.py`](../../agent/routers/auth.py)
  - [`agent/routers/organizations.py`](../../agent/routers/organizations.py)
- Key features:
  - Signup/login/token issuance.
  - Current developer profile.
  - Organization membership and invitations.
  - Role-aware organization-level management.

## App Lifecycle and Governance

- Routers:
  - [`agent/routers/apps.py`](../../agent/routers/apps.py)
  - [`agent/routers/api_keys.py`](../../agent/routers/api_keys.py)
  - [`agent/routers/audit.py`](../../agent/routers/audit.py)
- Key features:
  - CRUD for apps.
  - Per-app API key issuance/revocation.
  - Audit event retrieval for security/config history.

## Agent Configuration

- Router:
  - [`agent/routers/config.py`](../../agent/routers/config.py)
- Model:
  - [`agent/models/agent_config.py`](../../agent/models/agent_config.py)
- Key features:
  - `system_prompt`, `scope_mode`, LLM profile selection, context/tool/session limits.
  - Provider/model lookup and connection testing.
  - Audit-tracked config changes.

## Function Registry and Eligibility

- Router:
  - [`agent/routers/functions.py`](../../agent/routers/functions.py)
- Models/services:
  - [`agent/models/function_registry.py`](../../agent/models/function_registry.py)
  - [`agent/services/function_service.py`](../../agent/services/function_service.py)
  - [`agent/services/compatibility_service.py`](../../agent/services/compatibility_service.py)
- Key features:
  - Bulk function sync from SDK.
  - Dashboard overrides (active state, description/eligibility metadata).
  - Runtime filtering by platform/version/entitlements/capabilities.

## Playbooks (Structured Workflows)

- Router:
  - [`agent/routers/playbooks.py`](../../agent/routers/playbooks.py)
- Model:
  - [`agent/models/playbook.py`](../../agent/models/playbook.py)
- Key features:
  - CRUD playbooks and ordered function step association.
  - Runtime inclusion as structured workflow context in orchestrator prompts.

## Session Management and Context Ingestion

- Router:
  - [`agent/routers/sessions.py`](../../agent/routers/sessions.py)
- Model:
  - [`agent/models/session.py`](../../agent/models/session.py)
- Key features:
  - Session creation and ws-ticket issuance.
  - Per-session context fields:
    - `metadata`
    - `client_context`
    - `llm_context`
    - `entitlements`
    - `capabilities`
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
  - [`agent/services/provider_service.py`](../../agent/services/provider_service.py)
- Key features:
  - Router + enriched context architecture.
  - Scope mode enforcement (`open`/`strict`).
  - KB prefetch and fallback `kb_search` tool flow.
  - Playbook prompt enrichment.
  - Multi-round tool loop, usage tracking, message persistence.

## Knowledge Base Bridge

- Router:
  - [`agent/routers/knowledge_bases.py`](../../agent/routers/knowledge_bases.py)
- Bridge client:
  - [`agent/services/knowledge_bases_client.py`](../../agent/services/knowledge_bases_client.py)
- Local models:
  - [`agent/models/knowledge_base_ref.py`](../../agent/models/knowledge_base_ref.py)
  - [`agent/models/app_knowledge_base.py`](../../agent/models/app_knowledge_base.py)
- Key features:
  - KB CRUD and source management proxied to `knowledge_bases`.
  - Per-app KB assignments.
  - Organization embedding-profile management and impact checks.

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

