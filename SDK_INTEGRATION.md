# iOS App Agent - SDK Integration Guide

This document describes the current SDK-facing runtime contract.

## Authentication

All SDK requests use:

```http
Authorization: Bearer iaa_<your_key>
```

Session-scoped runtime calls also use:

```http
X-Resolvekit-Chat-Capability: <chat_capability_token>
```

## Session bootstrap

### `POST /v1/sessions`

Creates or reuses a chat session.

Key request fields:

- `device_id`
- `client`
- `llm_context`
- `available_function_names`
- `locale`
- `preferred_locales`
- `reuse_active_session`

Key response fields:

- `id`
- `events_url`
- `chat_capability_token`
- `reused_active_session`
- `chat_title`
- `message_placeholder`
- `initial_message`

## Event stream transport

### `GET /v1/sessions/{session_id}/events`

The SDK keeps one long-lived event stream open for the session.

- media type: `text/event-stream`
- optional query: `cursor=<last_event_id>`
- stream replay resumes from the first event after the supplied cursor

Each server event includes:

- SSE `id` header for resume cursor
- event type
- JSON envelope containing `event_id`, `turn_id`, `request_id`, `timestamp`, `type`, and `payload`

Event types:

- `assistant_text_delta`
- `tool_call_request`
- `turn_complete`
- `error`

## User turns

### `POST /v1/sessions/{session_id}/messages`

Submit a user turn asynchronously.

Request body:

```json
{
  "text": "Turn on the bedroom lights",
  "request_id": "client-generated-id",
  "locale": "en"
}
```

Response:

```json
{
  "turn_id": "server-turn-id",
  "request_id": "client-generated-id",
  "status": "accepted"
}
```

Rules:

- `request_id` is required and must be client-generated.
- repeated submits with the same `request_id` are idempotent.
- server output arrives on the session event stream, not on the POST response.

## Tool results

### `POST /v1/sessions/{session_id}/tool-results`

Submit an SDK tool result.

Request body:

```json
{
  "turn_id": "server-turn-id",
  "idempotency_key": "client-generated-or-call-based-key",
  "call_id": "tool-call-id",
  "status": "success",
  "result": {"ok": true},
  "error": null
}
```

Rules:

- repeated submits with the same `turn_id` + `call_id` + `idempotency_key` are deduplicated.
- the endpoint returns `404` if there is no pending tool call for that `call_id`.

## Session history and localization

### `GET /v1/sessions/{session_id}/messages`

Returns persisted session messages for reconnect or reopen flows.

### `GET /v1/sessions/{session_id}/localization`

Returns locale-aware `chat_title`, `message_placeholder`, and `initial_message`.

## Runtime behavior

Recommended SDK lifecycle:

1. `GET /v1/sdk/compat`
2. `GET /v1/sdk/chat-theme`
3. `PUT /v1/functions/bulk`
4. `POST /v1/sessions`
5. `GET /v1/sessions/{id}/events`
6. `POST /v1/sessions/{id}/messages`
7. `POST /v1/sessions/{id}/tool-results` as needed

Reconnect behavior:

- reopen `GET /events` with the last seen cursor
- keep the same `session_id`
- keep the same `chat_capability_token` until session expiry
- treat turn continuity as application-level replay, not socket continuity
