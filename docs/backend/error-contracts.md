# Error Contracts

## HTTP API errors (`agent`)

Common status patterns:

- `400`: invalid config/profile/state
- `401/403`: auth or permission failure
- `404`: app/session/resource not found
- `409`: conflicting active turn submission
- `410`: session expired
- `502`: upstream KB service failure

## Event stream errors

`GET /v1/sessions/{session_id}/events` delivers `error` events with:

- `code`
- `message`
- `recoverable`

Common runtime codes:

- `chat_unavailable`
- `transport_error`
- provider/config/session validation errors surfaced during turn execution

## Tool-result errors

`POST /v1/sessions/{session_id}/tool-results` returns:

- `404` when no matching pending tool call exists
- `200` with `deduplicated=true` for repeated idempotent submissions

## `chat_unavailable`

When chat availability checks fail, runtime paths return or emit:

- `code: chat_unavailable`
- standardized unavailable message from chat access service
