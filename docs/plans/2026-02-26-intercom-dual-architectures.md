# Intercom Dual Architectures for Playbook SDK Chat

Date: 2026-02-26  
Status: Draft architecture options for decision

## 1) Concept A: Playbook as Intermediary (Recommended First)

Goal: Keep SDK chat connected to `playbook_backend`, use Intercom as knowledge + human support system.

## High-Level

- iOS app uses Playbook SDK chat UI + existing Playbook WS/SSE transport.
- `ios_app_agent` remains the orchestration control plane (routing, tool execution, policies).
- `ios_app_agent` calls Intercom APIs directly for knowledge retrieval and handoff.
- Human agent replies in Intercom Inbox; replies are bridged back to SDK chat.

## Components

- `Playbook iOS SDK` (existing)
- `ios_app_agent` (existing + new Intercom adapter)
- `kb_service` (existing, optional caching/indexing)
- `Intercom API` (Articles search, Conversations, Webhooks)
- `Intercom Inbox` (human teammate channel)

## New Backend Modules

- `ios_app_agent/services/intercom_oauth_service.py`
- `ios_app_agent/services/intercom_client.py`
- `ios_app_agent/services/intercom_kb_service.py`
- `ios_app_agent/services/intercom_handoff_service.py`
- `ios_app_agent/routers/intercom.py`

## Data Model Additions

- `IntercomWorkspaceInstall`
  - org/workspace mapping, region, encrypted token, scopes
- `IntercomConversationMap`
  - `chat_session_id <-> intercom_conversation_id`
- `IntercomWebhookEvent`
  - event dedup/idempotency
- `ChatSession.mode`
  - `ai`, `handoff_pending`, `human`

## Runtime Sequences

### A1. AI Resolution in Playbook

1. User sends message in SDK chat.
2. `run_agent_loop` evaluates:
   - Playbook functions (device actions),
   - Intercom article search tool (`/articles/search`),
   - optional AI content lookup (list/read external pages).
3. Playbook responds in SDK chat.

### A2. Escalation to Human in Intercom

1. Orchestrator decides escalate (policy/tool/manual trigger).
2. Create or reuse Intercom conversation.
3. Persist mapping and set session mode `human`.
4. User messages route to Intercom conversation reply endpoint.
5. Intercom `conversation.admin.replied` webhook arrives.
6. Backend streams human message back to SDK chat as assistant/human event.

## Why this works well

- Preserves your strongest capability: device function execution over existing SDK session.
- Intercom is used as a support operation system, not as your runtime agent core.
- Lowest risk to ship with current Playbook architecture.

## Constraints

- Requires robust webhook ordering + dedup.
- Requires careful role labeling in chat transcript (AI vs human source).

---

## 2) Concept B: Intercom-First (SDK -> Intercom, Fin calls Playbook as external system)

Goal: SDK chat goes directly to Intercom; Fin decides when to call Playbook for device-backed actions.

## High-Level

- iOS app uses Intercom iOS SDK Messenger directly.
- Fin handles primary conversation and knowledge resolution.
- Fin invokes Playbook backend via Data connectors / Tasks for external data/actions.
- Playbook becomes an action gateway + device execution broker.

## Components

- `Intercom iOS SDK Messenger` in app
- `Fin` in Intercom (AI conversation control)
- `Playbook Action Gateway` (new service in `ios_app_agent`)
- `Playbook Device Relay` (existing WS/session path, plus async fallback)

## New Backend Modules

- `ios_app_agent/routers/intercom_actions.py` (connector endpoints)
- `ios_app_agent/services/intercom_connector_auth.py`
- `ios_app_agent/services/device_action_broker.py`
- `ios_app_agent/services/device_action_jobs.py` (if async needed)

## Runtime Sequences

### B1. Fin self-serve (no Playbook call)

1. User chats in Intercom Messenger.
2. Fin resolves from Intercom knowledge sources.

### B2. Fin triggers Playbook connector

1. Fin detects intent requiring app/device context.
2. Fin calls Playbook connector endpoint (HTTP).
3. Playbook broker maps user -> active device session.
4. Playbook sends tool request to device and waits for result (sync if quick).
5. Structured result returns to Fin; Fin replies to user.

### B3. Human handoff

1. Fin escalates to teammate in Inbox.
2. Human continues entirely in Intercom channel.

## Why this can work

- Clean ownership if you want Intercom to be the primary support platform.
- Fin + Inbox + Workflows all native in one place.

## Hard constraints

- Device actions must fit connector latency/availability envelope.
- If user device is offline, synchronous connector flows fail unless async orchestration is added.
- Some higher-end Fin surfaces are managed-availability, so feature access can gate rollout timing.

---

## 3) Capability Fit Matrix

| Requirement | Concept A (Playbook-first) | Concept B (Intercom-first) |
|---|---|---|
| On-device function execution reliability | Strong (native) | Medium (connector latency/offline risk) |
| Time-to-MVP | Fast | Medium |
| Uses Intercom human Inbox | Yes | Yes |
| Uses Intercom Help Center live search | Yes | Yes |
| Operational complexity | Medium | Medium/High |
| Dependency on managed-availability features | Low/Medium | Medium/High |

## 4) API/Feature Dependencies (current docs snapshot)

- Articles search exists: `GET /articles/search`.
- AI Content APIs focus on managing/listing external pages + import sources.
- Canvas Kit apps require default OAuth scopes (read conversations/admins/users + app data).
- Fin Agent API and Custom Channel/Fin over API are managed availability.
- Data connectors are generally available; Fin Tasks is managed availability.

## 5) Recommendation

1. Implement Concept A first.
2. Add Concept B as a targeted pilot path only for actions that can complete quickly and safely.
3. Keep a shared Playbook action contract so both concepts can reuse the same device tools.

## 6) Decision Triggers

Choose Concept A if:
- device execution quality and control is your product differentiator.

Choose Concept B if:
- you want Intercom to own most support UX/processes and accept connector limitations.

## 7) References

- Intercom iOS SDK: https://developers.intercom.com/installing-intercom/ios/about-the-sdk
- Articles search API: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/articles/searcharticles
- OAuth scopes: https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/oauth-scopes
- Reply to conversation: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/conversations/replyconversation
- Webhook topics: https://developers.intercom.com/docs/references/2.3/webhooks/webhook-models
- AI Content (external pages/import sources): https://developers.intercom.com/docs/references/rest-api/api.intercom.io/ai-content/external_pages_list
- Fin Agent API: https://developers.intercom.com/docs/references/2.14/rest-api/api.intercom.io/fin-agent
- Fin Custom Helpdesk API: https://developers.intercom.com/docs/guides/fin-custom-helpdesk/api
- Fin Tasks + Data connectors: https://www.intercom.com/help/en/articles/9569407-fin-tasks-and-data-connectors-explained

## 8) Full Research Log (This Session)

The following is the complete set of materials I used while producing the architectures.

## External sources reviewed

- https://developers.intercom.com/docs/canvas-kit  
  Used for app surface constraints and Canvas app scope assumptions.
- https://developers.intercom.com/installing-intercom/ios/about-the-sdk  
  Used to validate direct iOS SDK/Messenger feasibility.
- https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/oauth-scopes  
  Used to map required/optional scopes for each concept.
- https://developers.intercom.com/docs/references/2.14/rest-api/api.intercom.io/articles/searcharticles  
  Used to validate direct Help Center article search capability.
- https://developers.intercom.com/docs/guides/help-center/working-with-your-articles  
  Used to validate Help Center article API availability and CRUD scope context.
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/ai-content/content_import_sources_list  
  Used for AI Content source listing behavior (app-scoped language).
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/ai-content/external_pages_list  
  Used for AI Content external page list/read capability.
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/ai-content/external_page  
  Used for AI Content external page create/update semantics.
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/conversations/replyconversation  
  Used for handoff message bridge design.
- https://developers.intercom.com/docs/references/2.3/webhooks/webhook-models  
  Used for webhook topic selection and event dedup planning.
- https://developers.intercom.com/docs/references/2.14/rest-api/api.intercom.io/fin-agent  
  Used to validate Fin Agent API availability constraints.
- https://developers.intercom.com/docs/references/rest-api/api.intercom.io/custom-channel-events/notifynewconversation  
  Used to validate custom-channel/Fin-over-API pathway.
- https://developers.intercom.com/docs/guides/fin-custom-helpdesk  
  Used to validate Fin custom helpdesk integration model.
- https://developers.intercom.com/docs/guides/fin-custom-helpdesk/api  
  Used for concrete endpoint model in Fin custom helpdesk path.
- https://www.intercom.com/help/en/articles/9569407-fin-tasks-and-data-connectors-explained  
  Used to validate Fin tasks/data connector capabilities and managed-availability notes.
- https://www.intercom.com/help/en/articles/9440354-knowledge-sources-to-power-ai-agents-and-self-serve-support  
  Used for knowledge-source behavior assumptions for Fin.
- https://developers.intercom.com/docs/references/2.12/rest-api/api.intercom.io/ai-content  
  Used for earlier AI Content endpoint family validation.

## External source explored but not used as a primary foundation

- https://developers.intercom.com/docs/guides/fin-over-api/custom-channel-integration  
  Returned "Page not found" during this session; kept as a dead-end check.

## Local repository materials reviewed

- `/Users/t0405/.codex/superpowers/skills/using-superpowers/SKILL.md`
- `/Users/t0405/.codex/superpowers/skills/brainstorming/SKILL.md`
- `/Users/t0405/Developer/playbook_backend/docs/backend/services-overview.md`
- `/Users/t0405/Developer/playbook_backend/docs/backend/integration-map-sdk-to-backend.md`
- `/Users/t0405/Developer/playbook_backend/docs/backend/kb-service-capabilities.md`
- `/Users/t0405/Developer/playbook_backend/docs/backend/router-map.md`
- `/Users/t0405/Developer/playbook_backend/ios_app_agent/services/orchestrator.py`
- `/Users/t0405/Developer/playbook_backend/ios_app_agent/services/kb_service_client.py`
- `/Users/t0405/Developer/playbook_backend/ios_app_agent/routers/chat_http.py`
- `/Users/t0405/Developer/playbook_backend/ios_app_agent/routers/chat_ws.py`

## Local files scanned via targeted search (`rg`)

- `/Users/t0405/Developer/playbook_backend/CLAUDE.md`
- `/Users/t0405/Developer/playbook_backend/README.md`
- `/Users/t0405/Developer/playbook_backend/SDK_INTEGRATION.md`
- `/Users/t0405/Developer/playbook_backend/docker-compose.yml`
- `/Users/t0405/Developer/playbook_backend/kb_service/services/search.py`
- `/Users/t0405/Developer/playbook_backend/kb_service/router.py`
- `/Users/t0405/Developer/playbook_backend/ios_app_agent/services/provider_service.py`
- `/Users/t0405/Developer/playbook_backend/tests/test_orchestrator_kb_internal_tool.py`
- `/Users/t0405/Developer/playbook_backend/alembic/versions/001_initial.py`

## 9) Key Research Conclusions

- Concept A (Playbook intermediary) is immediately viable with current backend architecture and best preserves device tool reliability.
- Concept B (Intercom-first) is viable for selected use-cases but has stronger dependency on connector behavior, latency envelopes, and feature availability.
- Intercom Help Center has direct article search APIs; AI Content APIs are management/list/read oriented and should not be treated as equivalent full-text semantic search.
