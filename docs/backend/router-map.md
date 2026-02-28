# Router Map

This map groups endpoints by router and responsibility. For exact request/response schemas, use:

- [`dashboard.openapi.json`](../generated/openapi/dashboard.openapi.json)
- [`agent.openapi.json`](../generated/openapi/agent.openapi.json)
- [`knowledge_bases.openapi.json`](../generated/openapi/knowledge_bases.openapi.json)

Dashboard browser clients use dashboard `api` (Next route handlers under `/v1/*`) as the control-plane boundary.
`agent` is runtime-only and does not expose dashboard control-plane routes.

## `agent` routers

## Functions (`agent/routers/functions.py`)

SDK-facing:

- `PUT /v1/functions/bulk`
- `GET /v1/functions`
- `GET /v1/functions/eligible`

## Sessions (`agent/routers/sessions.py`)

SDK-facing:

- `POST /v1/sessions`
- `GET /v1/sessions/{session_id}/localization`
- `POST /v1/sessions/{session_id}/ws-ticket`
- `GET /v1/sessions/{session_id}/messages`

## Chat WS (`agent/routers/chat_ws.py`)

- `WS /v1/sessions/{session_id}/ws`

## Chat HTTP/SSE (`agent/routers/chat_http.py`)

- `POST /v1/sessions/{session_id}/messages` (SSE stream)
- `POST /v1/sessions/{session_id}/tool-results`

## SDK compatibility (`agent/routers/sdk.py`)

- `GET /v1/sdk/compat`
- `GET /v1/sdk/chat-theme`

## `knowledge_bases` router (`knowledge_bases/router.py`)

All endpoints are under `/internal/*`.

Knowledge bases:

- `POST /internal/kbs/list`
- `POST /internal/kbs/create`
- `POST /internal/kbs/get`
- `POST /internal/kbs/update`
- `POST /internal/kbs/embedding-change-impact`
- `POST /internal/kbs/delete`

Sources:

- `POST /internal/sources/list`
- `POST /internal/sources/add-url`
- `POST /internal/sources/add-upload`
- `POST /internal/sources/add-upload-file`
- `POST /internal/sources/recrawl`
- `POST /internal/sources/delete`

Jobs/documents/search:

- `POST /internal/jobs/list`
- `POST /internal/documents/list`
- `POST /internal/documents/delete`
- `POST /internal/search`
- `POST /internal/search/multi-kb`

Embedding profiles:

- `POST /internal/embedding-profiles/list`
- `POST /internal/embedding-profiles/create`
- `POST /internal/embedding-profiles/change-impact`
- `POST /internal/embedding-profiles/update`
- `POST /internal/embedding-profiles/delete`

Health:

- `GET /internal/health`
