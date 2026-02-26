# Unified Chat Support Architecture: Intercom + Zendesk

Date: 2026-02-26  
Status: Draft design for multi-vendor support

## 1. Objective

Support both Intercom and Zendesk without forking Playbook core logic, while preserving:

- Playbook SDK/device function execution quality,
- KB-assisted AI responses,
- human handoff to vendor support inboxes.

## 2. Scope and Non-Goals

In scope:

- A single backend architecture that can integrate with both vendors.
- Two runtime modes:
  - Playbook-first (SDK chat to Playbook),
  - Vendor-first (SDK chat to vendor messenger, vendor AI calls Playbook).
- Provider abstraction for KB search, conversation bridge, and handoff.

Out of scope:

- Replacing existing orchestrator logic.
- Full implementation details for every vendor endpoint payload.
- Billing/entitlement policy design.

## 3. Capability Snapshot (as of 2026-02-26)

## Intercom

- Mobile SDK available for direct app chat channel.
- Help Center article search API exists (`/articles/search`).
- Conversation reply + webhooks support human/AI bridge workflows.
- AI Content APIs are primarily manage/list/read for external pages and import sources.

## Zendesk

- iOS Messaging SDK available for direct app chat channel.
- Help Center search APIs exist (`/help_center/articles/search`, unified search).
- Programmable Conversations supports receiving/sending messages and switchboard `passControl` handoff.
- AI Agents can integrate with custom CRM/chat APIs, but action/plugin model is less direct than tool-calling.

Design implication:

- Multi-vendor support is feasible.
- Playbook-first should be primary for reliability of on-device function execution.
- Vendor-first should be optional and scoped to low-latency, robust action paths.

## 4. Architecture Principles

- Keep `run_agent_loop` as the core orchestration engine.
- Add vendor adapters around channel/KB/handoff concerns.
- Normalize provider payloads into Playbook internal schema.
- Make handoff state explicit in `ChatSession`.
- Prefer capability flags over provider-specific branching in orchestrator core.

## 5. Target Architecture

## 5.1 Core Layers

1. `Channel API Layer` (`ios_app_agent/routers`)
- Existing SDK chat routes remain unchanged.
- Add integration routes for Intercom and Zendesk installs, webhooks, and admin actions.

2. `Provider Adapter Layer` (`ios_app_agent/services/support_providers`)
- `base.py` (protocol/interfaces)
- `intercom.py`
- `zendesk.py`

3. `Orchestration Layer` (`ios_app_agent/services/orchestrator.py`)
- Keep existing behavior.
- Add provider tools via adapter-resolved capability flags.

4. `Knowledge Layer`
- Option A: direct live vendor search calls.
- Option B: sync selected content into `kb_service`.
- Runtime chooses based on app policy.

5. `Human Handoff Layer`
- Conversation mapping and relay between Playbook session and vendor conversation/thread.

## 5.2 Provider Interface (concept)

```python
class SupportProvider(Protocol):
    provider: Literal["intercom", "zendesk"]

    async def search_knowledge(self, workspace_id: str, query: str, limit: int) -> list[KnowledgeHit]: ...
    async def ensure_conversation(self, workspace_id: str, user_ref: str, context: dict) -> ConversationRef: ...
    async def send_message(self, workspace_id: str, conversation_id: str, text: str, role: str) -> None: ...
    async def parse_webhook(self, payload: dict, headers: dict) -> list[ProviderEvent]: ...
    async def handoff_to_human(self, workspace_id: str, conversation_id: str, reason: str) -> None: ...
    def capabilities(self) -> ProviderCapabilities: ...
```

## 5.3 Unified Tooling in Orchestrator

Add vendor-neutral internal tools:

- `provider_kb_search(query, top_k=5)`
- `handoff_to_human(reason)`
- `provider_get_conversation_context()`

Tool executor resolves active provider from session context and dispatches through adapter.

## 6. Runtime Modes

## Mode A: Playbook-First (Recommended default)

Flow:

1. SDK chat sends message to Playbook (`/v1/sessions/.../ws` or SSE).
2. Orchestrator calls:
   - SDK/device functions,
   - provider KB search tool (Intercom or Zendesk),
   - optional `kb_service` search.
3. If escalation needed:
   - create/attach vendor conversation,
   - switch session to human mode,
   - relay messages bidirectionally via webhooks + send APIs.

Benefits:

- Best fit with current code.
- Device execution remains first-class.
- Vendor can be swapped per app/workspace.

## Mode B: Vendor-First (Optional)

Flow:

1. App uses Intercom or Zendesk mobile SDK directly.
2. Vendor AI handles first response.
3. Vendor calls Playbook connector endpoint for device/app-specific actions.
4. Playbook maps user -> active session/device and returns structured action output.

Benefits:

- Vendor-native support UI and ops.

Risks:

- Online-device dependency for action completion.
- Provider-specific AI extensibility constraints.
- Harder to keep deterministic behavior across both vendors.

## 7. Data Model Additions

Vendor-agnostic:

- `SupportWorkspaceInstall`
  - `id`, `organization_id`, `provider`, `workspace_external_id`, `region`, `status`
  - encrypted auth credentials
  - granted scopes/capabilities snapshot
- `SupportAppBinding`
  - map Playbook `app_id` -> workspace install
  - policy: `runtime_mode`, `kb_mode`, `auto_reply_enabled`
- `SupportConversationMap`
  - `provider`, `provider_conversation_id`, `chat_session_id`, `end_user_ref`
- `SupportEventDedup`
  - `provider`, `event_id`, `processed_at`, `status`

Session extension:

- `ChatSession.support_mode`: `ai`, `handoff_pending`, `human`
- `ChatSession.support_provider`: nullable enum `intercom|zendesk`

## 8. Backend API Additions

Base:

- `POST /v1/integrations/support/install`
- `GET /v1/integrations/support/workspaces`
- `PUT /v1/apps/{app_id}/support-binding`
- `POST /v1/integrations/support/webhooks/{provider}`
- `POST /v1/sessions/{session_id}/handoff`

Provider-specific:

- Intercom OAuth callback/install routes.
- Zendesk OAuth/install routes.

Optional admin ops:

- `POST /v1/apps/{app_id}/support/kb-search-test`
- `POST /v1/apps/{app_id}/support/sync-kb`

## 9. Knowledge Strategy

Per app binding, choose:

- `live_provider_only`: search vendor KB APIs at runtime.
- `playbook_only`: use `kb_service` only.
- `hybrid`: provider live search + Playbook KB rerank/merge.

Recommended default:

- start with `live_provider_only` for fastest launch,
- move selected customers to `hybrid` if quality/latency requires.

## 10. Security and Compliance

- Encrypt provider tokens at rest (same pattern as existing encrypted secrets).
- Verify webhook signatures per provider.
- Enforce least-privilege scopes by feature.
- Record all cross-system actions in existing audit events.
- Mask provider payload PII in logs.

## 11. Reliability and Failure Modes

- Idempotency:
  - dedup table per provider event id.
- Retry policy:
  - transient provider API failures with capped exponential backoff.
- Circuit breaker:
  - disable provider tools per workspace when error rate exceeds threshold.
- Fallback:
  - if provider KB fails, continue with Playbook knowledge and explicit uncertainty.

## 12. Rollout Plan

## Phase 0: Abstraction foundation

- Implement provider interface + shared workspace/binding models.
- Wire orchestrator internal tools to adapter interface.

## Phase 1: Intercom in Mode A

- OAuth, webhook ingest, live Help Center search, human handoff relay.

## Phase 2: Zendesk in Mode A

- OAuth/install, messaging webhook ingest/send, Help Center search, switchboard handoff.

## Phase 3: Hybrid KB and observability

- Optional `kb_service` sync/rerank path.
- Provider-specific SLO dashboards and tracing.

## Phase 4: Mode B pilots

- Limited Intercom-first and Zendesk-first pilots for selected tenants.

## 13. Testing Plan

- Unit:
  - provider adapter normalization,
  - webhook signature verification,
  - dedup + replay handling.
- Contract:
  - fixture tests for Intercom and Zendesk webhook payloads.
- Integration:
  - end-to-end relay: user message -> AI response -> handoff -> human reply back to SDK.
- Load:
  - webhook bursts + downstream provider rate limit behavior.

## 14. Decision Guidance

Default recommendation:

1. Build unified provider abstraction once.
2. Ship both providers in Mode A first.
3. Add Mode B only where business value justifies extra operational complexity.

## 15. Sources

Intercom:

- https://developers.intercom.com/installing-intercom/ios/about-the-sdk
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/articles/searcharticles
- https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/oauth-scopes
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/conversations/replyconversation
- https://developers.intercom.com/docs/references/2.3/webhooks/webhook-models
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/ai-content/external_pages_list
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/ai-content/content_import_sources_list

Zendesk:

- https://developer.zendesk.com/documentation/zendesk-web-widget-sdks/sdks/ios/getting_started/
- https://developer.zendesk.com/api-reference/help_center/help-center-api/help_center_search/
- https://developer.zendesk.com/documentation/conversations/messaging-platform/programmable-conversations/receiving-messages/
- https://developer.zendesk.com/documentation/conversations/messaging-platform/programmable-conversations/sending-messages/
- https://developer.zendesk.com/documentation/conversations/messaging-platform/programmable-conversations/switchboard/
- https://developer.zendesk.com/api-reference/ai-agents/chat/chat/
- https://developer.zendesk.com/documentation/ai-agents/getting-started/configure-custom-crm/
- https://developer.zendesk.com/documentation/integration-services/developer-guide/zis-custom-actions/
