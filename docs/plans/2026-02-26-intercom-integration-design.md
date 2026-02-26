# Intercom Integration Design (SDK + Platform Adapter)

Date: 2026-02-26  
Owner: Platform

## 1. Goal

Build an Intercom integration that reuses `playbook_backend` orchestration, KB retrieval, and playbooks to:

- assist support agents inside Intercom Inbox,
- optionally auto-reply to customer conversations,
- leverage existing Help Center content where possible,
- avoid duplicating Fin-specific features unless required.

## 2. Current-State Fit in This Repo

Existing architecture already provides most core primitives:

- `ios_app_agent` owns auth, app config, sessions, orchestration, function/tool execution.
- `kb_service` owns ingestion + search and already supports multi-KB search.
- Orchestrator supports:
  - strict/in-scope routing,
  - KB prefetch + internal `kb_search` tool,
  - playbook guidance,
  - streaming-compatible sender abstraction (`MessageSender`).

This means Intercom can be an additional channel adapter, not a new AI stack.

## 3. Integration Approaches

## Option A (Recommended): Intercom Channel Adapter on Existing Backend

- Add Intercom app integration endpoints into `ios_app_agent`.
- Use Intercom webhooks + conversations API for input/output.
- Reuse current `run_agent_loop` with a new Intercom-specific `MessageSender`.
- Keep KB source-of-truth in Playbook KB; optionally ingest Intercom Help Center articles into Playbook KB.

Pros:
- Maximum reuse of existing orchestration and KB behavior.
- Single policy/control plane across iOS SDK and Intercom.
- Fastest path to MVP with least net-new infra.

Cons:
- Requires adapter and event-processing correctness (idempotency/loop prevention).
- Intercom API/versioning constraints still apply.

## Option B: Intercom as Pure UI Surface (No Auto-Reply)

- Build only Canvas Kit Inbox app.
- Agent clicks "Ask Playbook" panel; no webhook-triggered automation.
- Human teammate decides whether to send suggested response.

Pros:
- Lowest operational risk.
- Avoids bot loops and automation edge cases.

Cons:
- Lower impact and no deflection automation.
- Still requires agent interaction per case.

## Option C: Fin-First with Light Playbook Assist

- Use Fin Agent API for primary automated conversation handling.
- Use Playbook backend only for deep-domain function execution or niche KB retrieval.

Pros:
- Lean on Intercom native automation.

Cons:
- Fin Agent API is managed-availability.
- Harder control over combined behavior.
- More moving pieces and weaker reuse of current orchestrator.

Recommendation: **Option A** with phased rollout (start with B behavior in Phase 1 UI, then add automation).

## 4. Recommended Architecture (Option A)

## 4.1 New Components in `ios_app_agent`

Add router module, e.g. `ios_app_agent/routers/intercom.py`:

- `GET /v1/integrations/intercom/oauth/start`
- `GET /v1/integrations/intercom/oauth/callback`
- `POST /v1/integrations/intercom/canvas/initialize`
- `POST /v1/integrations/intercom/canvas/submit`
- `POST /v1/integrations/intercom/webhooks`
- `POST /v1/integrations/intercom/sync/help-center` (admin-triggered/manual MVP)

Add service modules:

- `intercom_oauth_service.py`
- `intercom_api_client.py`
- `intercom_webhook_service.py`
- `intercom_sync_service.py`
- `intercom_sender.py` (implements `MessageSender`)

## 4.2 Data Model Additions

- `IntercomWorkspaceInstall`
  - `organization_id`
  - `intercom_workspace_id`
  - `region` (`us|eu|au`)
  - encrypted access token (+ refresh token if issued)
  - scopes granted
  - status + timestamps
- `IntercomAppBinding`
  - maps Playbook `app_id` <-> Intercom workspace install
  - policy flags (`human_review_only`, `auto_reply_enabled`)
- `IntercomConversationMap`
  - `intercom_conversation_id` <-> `chat_session_id`
  - `intercom_contact_id`
- `IntercomEventDedup`
  - `event_id`, processed_at (idempotency)

## 4.3 Runtime Flow (Automation)

1. Intercom sends webhook (e.g. `conversation.user.created`, `conversation.user.replied`).
2. Verify app/workspace mapping and deduplicate event.
3. Resolve or create `ChatSession` with:
   - `platform=intercom` in `client_context`,
   - conversation/contact metadata in `llm_context`.
4. Call `run_agent_loop(...)` with:
   - functions list (initially empty for MVP, KB + playbooks still work),
   - Intercom sender implementation.
5. Sender posts assistant text back using Intercom conversation reply endpoint.
6. Persist event + response mapping for traceability.

## 4.4 Inbox Agent Assist Flow (Canvas Kit)

1. Teammate opens conversation details app.
2. Intercom sends Canvas Initialize POST to adapter endpoint.
3. Backend returns canvas showing:
   - suggested reply,
   - citations/source snippets (optional),
   - actions: "Insert draft", "Regenerate", "Open related playbook".
4. Canvas Submit actions call adapter; adapter fetches context and recomputes suggestion.

This is a safe first-user path even before enabling full auto-reply.

## 5. OAuth Scope Plan

Start minimal, then expand by feature:

Required for Canvas Kit baseline (auto-selected by Intercom for Canvas Kit apps):
- Read and list users and companies
- Read conversations
- Read admins
- Gather App data

For replying/automation:
- Write conversations

For Help Center ingest:
- Read and List articles

Optional (only if needed):
- Read and Write Articles (if writing back)
- Read tickets / Write tickets (ticket-triggered workflows)
- Read and write AI content (only if integrating Fin Content Library external pages APIs)

## 6. Knowledge Base Strategy

## 6.1 What We Can Access Reliably

- Existing Intercom Help Center articles/collections are accessible via article/help center APIs (with article scopes).
- This supports one-way sync into Playbook KB (`kb_service`) for unified retrieval quality and policy control.

## 6.2 Important Constraint

- Intercom AI Content APIs are designed around creating/managing External Pages and Content Import Sources.
- Docs indicate content import source listing is "for the App", so do not assume broad read access to every already-connected workspace knowledge source via plugin API.

Design implication:
- Treat Help Center API as dependable baseline.
- Treat Fin Content Library deep access as optional/conditional capability.

## 7. MVP Plan (Low-Risk Sequence)

## Phase 0: Install + Connectivity

- OAuth install, token storage, workspace binding.
- Webhook endpoint with dedup + logging.
- No automated replies yet.

Exit criteria:
- Receive and persist conversation webhook events.

## Phase 1: Inbox Companion (Human in the Loop)

- Canvas Kit app in conversation details.
- "Generate suggested reply" using existing orchestrator.
- Agent manually sends message.

Exit criteria:
- Teammates can request and use suggestions from real conversations.

## Phase 2: Controlled Auto-Reply

- Enable auto-reply only for selected queues/tags.
- Strict loop prevention + backoff + kill switch.
- Conversation-level audit trail in existing app audit events.

Exit criteria:
- Stable auto responses on narrow scope without loops/regressions.

## Phase 3: KB Enrichment

- Scheduled/manual sync of Intercom articles to Playbook KB.
- Per-app KB assignment through existing `AppKnowledgeBase` paths.

Exit criteria:
- Retrieval quality improves and citations align with Help Center docs.

## 8. Risks and Mitigations

- Reply loops:
  - Ignore admin/operator reply topics for trigger path.
  - Deduplicate by webhook `id`.
  - Attach reply marker metadata to avoid re-trigger from self-generated parts.
- Permission sprawl:
  - keep scopes minimal for MVP.
- API-version payload drift:
  - pin and test Intercom API version.
  - maintain payload fixtures for webhook parsing.
- Reliability:
  - queue webhook processing and retry transient failures.
  - maintain dead-letter path for malformed payloads.

## 9. Testing Strategy

- Unit tests:
  - webhook dedup/idempotency,
  - event-to-session mapping,
  - loop prevention logic,
  - Intercom sender behavior.
- Contract tests:
  - Intercom webhook payload fixtures and Canvas requests.
- Integration tests:
  - end-to-end simulated conversation webhook -> Playbook response -> Intercom API reply call.
- Manual verification:
  - private Intercom workspace test app,
  - validate article sync and KB query quality.

## 10. Build-Ready Scope Decision

If we start now, build **Phase 1** first (Inbox companion + human-in-loop suggestions), then Phase 2 automation behind a feature flag.
