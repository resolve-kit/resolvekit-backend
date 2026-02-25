# iOS App Agent Capabilities

This document maps functional capabilities to concrete implementation modules in `ios_app_agent`.

## Entry Point

- App bootstrap: [`ios_app_agent/main.py`](../../ios_app_agent/main.py)
- Health: `GET /health`

## Capability Areas

## Authentication and Identity

- Routers:
  - [`ios_app_agent/routers/auth.py`](../../ios_app_agent/routers/auth.py)
  - [`ios_app_agent/routers/organizations.py`](../../ios_app_agent/routers/organizations.py)
- Key features:
  - Signup/login/token issuance.
  - Current developer profile.
  - Organization membership and invitations.
  - Role-aware organization-level management.

## App Lifecycle and Governance

- Routers:
  - [`ios_app_agent/routers/apps.py`](../../ios_app_agent/routers/apps.py)
  - [`ios_app_agent/routers/api_keys.py`](../../ios_app_agent/routers/api_keys.py)
  - [`ios_app_agent/routers/audit.py`](../../ios_app_agent/routers/audit.py)
- Key features:
  - CRUD for apps.
  - Per-app API key issuance/revocation.
  - Audit event retrieval for security/config history.

## Agent Configuration

- Router:
  - [`ios_app_agent/routers/config.py`](../../ios_app_agent/routers/config.py)
- Model:
  - [`ios_app_agent/models/agent_config.py`](../../ios_app_agent/models/agent_config.py)
- Key features:
  - `system_prompt`, `scope_mode`, LLM profile selection, context/tool/session limits.
  - Provider/model lookup and connection testing.
  - Audit-tracked config changes.

## Function Registry and Eligibility

- Router:
  - [`ios_app_agent/routers/functions.py`](../../ios_app_agent/routers/functions.py)
- Models/services:
  - [`ios_app_agent/models/function_registry.py`](../../ios_app_agent/models/function_registry.py)
  - [`ios_app_agent/services/function_service.py`](../../ios_app_agent/services/function_service.py)
  - [`ios_app_agent/services/compatibility_service.py`](../../ios_app_agent/services/compatibility_service.py)
- Key features:
  - Bulk function sync from SDK.
  - Dashboard overrides (active state, description/eligibility metadata).
  - Runtime filtering by platform/version/entitlements/capabilities.

## Playbooks (Structured Workflows)

- Router:
  - [`ios_app_agent/routers/playbooks.py`](../../ios_app_agent/routers/playbooks.py)
- Model:
  - [`ios_app_agent/models/playbook.py`](../../ios_app_agent/models/playbook.py)
- Key features:
  - CRUD playbooks and ordered function step association.
  - Runtime inclusion as structured workflow context in orchestrator prompts.

## Session Management and Context Ingestion

- Router:
  - [`ios_app_agent/routers/sessions.py`](../../ios_app_agent/routers/sessions.py)
- Model:
  - [`ios_app_agent/models/session.py`](../../ios_app_agent/models/session.py)
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
  - [`ios_app_agent/routers/chat_ws.py`](../../ios_app_agent/routers/chat_ws.py)
  - [`ios_app_agent/routers/chat_http.py`](../../ios_app_agent/routers/chat_http.py)
- Key features:
  - WS envelope protocol (stream deltas, tool calls, tool results, turn completion, errors).
  - SSE fallback for environments without stable WS transport.
  - Capability-token gating and chat availability checks.

## Orchestration and LLM Runtime

- Core module:
  - [`ios_app_agent/services/orchestrator.py`](../../ios_app_agent/services/orchestrator.py)
- Supporting modules:
  - [`ios_app_agent/services/llm_service.py`](../../ios_app_agent/services/llm_service.py)
  - [`ios_app_agent/services/chat_access_service.py`](../../ios_app_agent/services/chat_access_service.py)
  - [`ios_app_agent/services/provider_service.py`](../../ios_app_agent/services/provider_service.py)
- Key features:
  - Router + enriched context architecture.
  - Scope mode enforcement (`open`/`strict`).
  - KB prefetch and fallback `kb_search` tool flow.
  - Playbook prompt enrichment.
  - Multi-round tool loop, usage tracking, message persistence.

## Knowledge Base Bridge

- Router:
  - [`ios_app_agent/routers/knowledge_bases.py`](../../ios_app_agent/routers/knowledge_bases.py)
- Bridge client:
  - [`ios_app_agent/services/kb_service_client.py`](../../ios_app_agent/services/kb_service_client.py)
- Local models:
  - [`ios_app_agent/models/knowledge_base_ref.py`](../../ios_app_agent/models/knowledge_base_ref.py)
  - [`ios_app_agent/models/app_knowledge_base.py`](../../ios_app_agent/models/app_knowledge_base.py)
- Key features:
  - KB CRUD and source management proxied to `kb_service`.
  - Per-app KB assignments.
  - Organization embedding-profile management and impact checks.

## SDK Compatibility and Guardrails

- Router:
  - [`ios_app_agent/routers/sdk.py`](../../ios_app_agent/routers/sdk.py)
- Config:
  - [`ios_app_agent/config.py`](../../ios_app_agent/config.py)
- Key features:
  - Declares minimum and supported SDK major versions.
  - Exposes required client fields for runtime context.

## Related Docs

- [Router Map](router-map.md)
- [Orchestrator Flow](orchestrator-flow.md)
- [SDK-to-Backend Integration Map](integration-map-sdk-to-backend.md)
- [OpenAPI Contract](../generated/openapi/ios_app_agent.openapi.json)

