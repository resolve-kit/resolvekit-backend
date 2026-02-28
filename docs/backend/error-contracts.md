# Error Contracts

This document summarizes error semantics used by API and chat transports.

## HTTP API errors (`agent`)

- Uses standard FastAPI HTTP exceptions with structured detail payloads.
- Common status patterns:
  - `400`: invalid config/profile/state.
  - `401/403`: auth/permission failure.
  - `404`: app/session/resource not found.
  - `410`: session expired (SSE send path).
  - `502`: upstream KB service response/availability issue.

Reference:

- [`agent/routers`](../../agent/routers)
- [OpenAPI](../generated/openapi/agent.openapi.json)

## WebSocket error events

WS route: `/v1/sessions/{session_id}/ws`.

`error` envelope payload:

- `code: string`
- `message: string`
- `recoverable: bool`

Common codes:

- `auth_failed`
- `session_not_found`
- `no_config`
- `no_llm_profile`
- `invalid_llm_profile`
- `session_expired`
- `invalid_json`
- `empty_message`
- `turn_in_progress`
- `agent_error`
- `chat_unavailable`

Close code patterns:

- `4001`: auth failed.
- `4002`: configuration/profile invalid for runtime.
- `4003`: capability/session unavailable.
- `4004`: session ownership/not found.

Reference: [`agent/routers/chat_ws.py`](../../agent/routers/chat_ws.py)

## SSE error events

SSE message route: `POST /v1/sessions/{session_id}/messages`.

Errors are surfaced either as HTTP status (pre-stream) or as streamed `error` events with:

- `code`
- `message`
- `recoverable`

Tool-result submit endpoint returns `404` when no matching pending tool call exists.

Reference: [`agent/routers/chat_http.py`](../../agent/routers/chat_http.py)

## `chat_unavailable` contract

When chat availability checks fail (disabled integration, invalid capability token, provider unavailable), runtime paths return/emit:

- code: `chat_unavailable`
- message: standardized unavailable message from chat access service.

Reference: [`agent/services/chat_access_service.py`](../../agent/services/chat_access_service.py)

## KB service error mapping

`agent` runtime wraps KB client failures surfaced from `agent/services/knowledge_bases_client.py` when KB retrieval is used in orchestration.

Dashboard control-plane KB endpoints (`dashboard/src/app/v1/knowledge-bases/**`) map errors through `dashboard/src/lib/server/kb-service.ts`.

Common mapping behavior:

- status code
- optional upstream error `code`
- detail message

Reference:

- [`agent/services/knowledge_bases_client.py`](../../agent/services/knowledge_bases_client.py)
- [`dashboard/src/lib/server/kb-service.ts`](../../dashboard/src/lib/server/kb-service.ts)
