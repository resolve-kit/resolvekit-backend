# SDK-to-Backend Integration Map

This map links `playbook-ios-sdk` runtime actions to backend endpoints and backend internals.

## Startup and Compatibility

SDK action:

- `PlaybookRuntime.start()`

Backend calls:

- `GET /v1/sdk/compat`
  - Router: [`agent/routers/sdk.py`](../../agent/routers/sdk.py)
  - Purpose: minimum/supported SDK versions and required client context fields.
- `GET /v1/sdk/chat-theme`
  - Router: [`agent/routers/sdk.py`](../../agent/routers/sdk.py)
  - Purpose: returns per-app light/dark chat palette used by SDK UI.

## Function Registration

SDK action:

- `PlaybookAPIClient.bulkSyncFunctions(...)`

Backend calls:

- `PUT /v1/functions/bulk`
  - Router: [`agent/routers/functions.py`](../../agent/routers/functions.py)
  - Persists function schema/metadata in `RegisteredFunction`.

## Session Creation and Context Ingestion

SDK action:

- `PlaybookAPIClient.createSession(...)`

Backend call:

- `POST /v1/sessions`
  - Router: [`agent/routers/sessions.py`](../../agent/routers/sessions.py)
  - Writes `ChatSession` with:
    - `device_id`
    - `client_context`
    - `llm_context`
    - `entitlements`
    - `capabilities`
    - `locale`
    - `preferred_locales`

## WS Ticket and Connection

SDK action:

- `PlaybookAPIClient.createWSTicket(...)`
- open websocket to `ws_url` with `ticket`

Backend calls:

- `POST /v1/sessions/{session_id}/ws-ticket`
- `WS /v1/sessions/{session_id}/ws`

WS runtime is implemented in [`agent/routers/chat_ws.py`](../../agent/routers/chat_ws.py).

## Chat Message and Tool Execution (WS)

SDK transport message:

- `chat_message`

Backend path:

- `run_agent_loop(...)` in orchestrator

Backend emits:

- `assistant_text_delta`
- `tool_call_request`
- `turn_complete`
- `error`

SDK responds with:

- `tool_result`

## Chat Message and Tool Execution (SSE fallback)

SDK fallback calls:

- `POST /v1/sessions/{session_id}/messages` (SSE stream)
- `POST /v1/sessions/{session_id}/tool-results`

Backend path:

- [`agent/routers/chat_http.py`](../../agent/routers/chat_http.py)

## KB-Driven Answers

SDK itself does not call KB APIs directly.

Backend orchestrator internally:

1. Loads app-assigned KB references.
2. Executes prefetch KB search via `knowledge_bases`.
3. Injects relevant documentation into prompt.
4. Uses `kb_search` fallback tool for additional retrieval if needed.

## Playbooks and Function Eligibility

SDK provides:

- Function definitions + availability metadata.
- Runtime session context (`platform`, app version, entitlements, capabilities, custom `llm_context`).

Backend uses:

- Function eligibility filtering in `get_eligible_functions`.
- ResolveKit step context in prompt enrichment.

## Source Files

Backend:

- `agent/routers/sessions.py`
- `agent/routers/chat_ws.py`
- `agent/routers/chat_http.py`
- `agent/services/orchestrator.py`

SDK:

- `Sources/PlaybookUI/PlaybookRuntime.swift`
- `Sources/PlaybookNetworking/PlaybookAPIClient.swift`
- `Sources/PlaybookNetworking/PlaybookWebSocketClient.swift`
- `Sources/PlaybookNetworking/PlaybookSSEClient.swift`
