# SDK Capabilities Reference

## 1. Session Management

Session start uses `POST /v1/sessions` and returns:

- `id`
- `events_url`
- `chat_capability_token`
- `reused_active_session`
- localization strings

Session reuse and history restore remain mandatory.

## 2. Transport

ResolveKit now uses one persistent session event stream plus HTTP writes.

### Event stream

- `GET /v1/sessions/{id}/events`
- authenticated with `Authorization` and `X-Resolvekit-Chat-Capability`
- resume with `?cursor=<last_event_id>`

### User messages

- `POST /v1/sessions/{id}/messages`
- body includes `text`, `request_id`, and optional `locale`
- returns `turn_id` and acknowledgement status

### Tool results

- `POST /v1/sessions/{id}/tool-results`
- body includes `turn_id`, `idempotency_key`, `call_id`, status, and payload

### Connection states

- `idle`
- `registering`
- `connecting`
- `active`
- `reconnecting`
- `reconnected`
- `blocked`
- `failed`

## 3. Runtime event types

Server emits these over the event stream:

- `assistant_text_delta`
- `tool_call_request`
- `turn_complete`
- `error`

## 4. Compatibility

`GET /v1/sdk/compat` remains the startup gate for minimum and supported SDK versions.
