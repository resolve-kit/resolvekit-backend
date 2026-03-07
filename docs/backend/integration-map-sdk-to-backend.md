# SDK-to-Backend Integration Map

## Startup

SDK runtime start performs:

- `GET /v1/sdk/compat`
- `GET /v1/sdk/chat-theme`
- `PUT /v1/functions/bulk`
- `POST /v1/sessions`
- `GET /v1/sessions/{session_id}/events`

## Session bootstrap

`POST /v1/sessions` stores:

- `device_id`
- `client_context`
- `llm_context`
- `available_function_names`
- `locale`
- `preferred_locales`

The response includes `events_url` and `chat_capability_token`.

## Turn flow

SDK submits:

- `POST /v1/sessions/{session_id}/messages`

Backend runs `run_agent_loop(...)` and emits:

- `assistant_text_delta`
- `tool_call_request`
- `turn_complete`
- `error`

SDK replies with:

- `POST /v1/sessions/{session_id}/tool-results`

## Source files

Backend:

- `agent/routers/sessions.py`
- `agent/routers/chat_events.py`
- `agent/services/orchestrator.py`
- `agent/services/event_stream_service.py`
