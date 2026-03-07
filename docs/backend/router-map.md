# Router Map

## `agent` routers

## Functions (`agent/routers/functions.py`)

- `PUT /v1/functions/bulk`
- `GET /v1/functions`
- `GET /v1/functions/eligible`

## Sessions (`agent/routers/sessions.py`)

- `POST /v1/sessions`
- `PATCH /v1/sessions/{session_id}/context`
- `GET /v1/sessions/{session_id}/localization`
- `GET /v1/sessions/{session_id}/messages`

## Chat Events (`agent/routers/chat_events.py`)

- `GET /v1/sessions/{session_id}/events`
- `POST /v1/sessions/{session_id}/messages`
- `POST /v1/sessions/{session_id}/tool-results`

## SDK compatibility (`agent/routers/sdk.py`)

- `GET /v1/sdk/compat`
- `GET /v1/sdk/chat-theme`
