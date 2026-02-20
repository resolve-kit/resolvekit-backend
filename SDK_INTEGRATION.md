# iOS App Agent — SDK Integration Guide

> Complete reference for building an SDK that communicates with the iOS App Agent backend.
> This document describes all SDK-facing APIs, the WebSocket protocol, authentication, and the full agent orchestration lifecycle.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Function Registration](#2-function-registration)
3. [Session Management](#3-session-management)
4. [SDK Compatibility](#4-sdk-compatibility)
5. [WebSocket Chat Protocol](#5-websocket-chat-protocol)
6. [HTTP SSE Chat (Fallback)](#6-http-sse-chat-fallback)
7. [Orchestrator Flow](#7-orchestrator-flow)
8. [Error Codes](#8-error-codes)
9. [Timeouts & Reconnection](#9-timeouts--reconnection)
10. [Complete Interaction Sequence](#10-complete-interaction-sequence)

---

## 1. Authentication

SDK endpoints use **API key** authentication (not JWT — JWT is for the developer dashboard only).

### Key format

Keys are prefixed with `iaa_` and look like `iaa_a1b2c3d4e5f6...`. The raw key is shown once at creation time; the server stores only its SHA-256 hash.

### HTTP endpoints

Pass the key in the `Authorization` header:

```
Authorization: Bearer iaa_<your_key>
```

### WebSocket

Pass the key as a query parameter (WebSocket clients typically cannot set custom headers during handshake):

```
ws://<host>/v1/sessions/{session_id}/ws?api_key=iaa_<your_key>
```

On auth failure the server sends an error frame and closes the socket with code `4001`.

---

## 2. Function Registration

The SDK must register its locally-callable functions with the backend. This tells the LLM what tools are available on-device.

### `PUT /v1/functions/bulk`

Idempotent full-sync. Call on every app launch.

**Request:**

```json
{
  "functions": [
    {
      "name": "setLights",
      "description": "Turn lights on or off in a room",
      "parameters_schema": {
        "type": "object",
        "properties": {
          "room": { "type": "string" },
          "on": { "type": "boolean" }
        },
        "required": ["room", "on"]
      },
      "timeout_seconds": 30
    },
    {
      "name": "getWeather",
      "description": "Get current weather for a location",
      "parameters_schema": {
        "type": "object",
        "properties": {
          "city": { "type": "string" }
        },
        "required": ["city"]
      },
      "timeout_seconds": 10
    }
  ]
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | — | Unique per app. Used as the LLM tool name. |
| `description` | string | no | `""` | Shown to the LLM to decide when to call the function. |
| `parameters_schema` | object | no | `{}` | JSON Schema describing the function's arguments. |
| `timeout_seconds` | int | no | `30` | Server-enforced per-call timeout. |
| `availability` | object | no | `{}` | Compatibility rules: `platforms`, `min_os_version`, `max_os_version`, `min_app_version`, `max_app_version`. |
| `required_entitlements` | string[] | no | `[]` | Entitlements required in session context (for example subscription tiers). |
| `required_capabilities` | string[] | no | `[]` | Required runtime capabilities (for example hardware/API support). |
| `source` | string | no | `"app_inline"` | Provenance: `app_inline` or `playbook_pack`. |
| `pack_name` | string or null | no | `null` | Optional function pack identifier. |

**Behavior:**

- Functions in the request that already exist are **updated** and re-activated.
- Functions in the DB but **absent** from the request are **deactivated** (`is_active = false`).
- New names are **inserted**.

**Response:** `200 OK` — array of upserted functions:

```json
[
  {
    "id": "uuid",
    "app_id": "uuid",
    "name": "setLights",
    "description": "Turn lights on or off in a room",
    "description_override": null,
    "parameters_schema": { ... },
    "is_active": true,
    "timeout_seconds": 30,
    "created_at": "2026-02-19T10:00:00Z"
  }
]
```

> `description_override` — if the developer sets an override via the dashboard, this value takes precedence when the LLM sees the tool. The SDK does not need to handle this; it's informational.

### `GET /v1/functions`

Returns all active functions for the app. Useful for verifying registration state.

### `GET /v1/functions/eligible?session_id=<uuid>`

Returns only functions eligible for a given session context after compatibility + entitlement filtering.

---

## 3. Session Management

### `POST /v1/sessions`

Create a new chat session.

**Request:**

```json
{
  "device_id": "iPhone15-ABC123",
  "client": {
    "platform": "ios",
    "os_name": "iOS",
    "os_version": "18.2",
    "app_version": "1.0.3",
    "app_build": "103",
    "sdk_name": "playbook-ios-sdk",
    "sdk_version": "1.0.0"
  },
  "entitlements": ["pro"],
  "capabilities": ["camera", "location"],
  "metadata": {
    "os_version": "18.2",
    "app_version": "1.0.3"
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `device_id` | string | no | `null` | Stable device identifier. |
| `client` | object | no | `null` | Structured compatibility context (recommended). |
| `entitlements` | string[] | no | `[]` | User/app entitlements (for paywall-aware tool access). |
| `capabilities` | string[] | no | `[]` | Device/runtime capabilities. |
| `metadata` | object | no | `{}` | Arbitrary key-value pairs stored with the session. |

**Response:** `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "app_id": "uuid",
  "device_id": "iPhone15-ABC123",
  "status": "active",
  "last_activity_at": "2026-02-19T10:00:00Z",
  "created_at": "2026-02-19T10:00:00Z",
  "ws_url": "/v1/sessions/550e8400-e29b-41d4-a716-446655440000/ws"
}
```

`ws_url` is a **relative path**. Prepend your server's base URL and swap the scheme:

```
https://api.example.com → wss://api.example.com/v1/sessions/{id}/ws?api_key=iaa_...
```

### Session lifecycle

| Status | Meaning |
|--------|---------|
| `active` | Usable — the SDK can send messages. |
| `expired` | TTL exceeded (default 60 min of inactivity). No further messages accepted. |
| `closed` | Explicitly closed (reserved for future use). |

`last_activity_at` is updated on every `chat_message`. The session expires when `now - last_activity_at > session_ttl_minutes`.

---

## 4. SDK Compatibility

### `GET /v1/sdk/compat`

Use this before starting a session to check if the SDK version is supported.

**Response:**

```json
{
  "minimum_sdk_version": "1.0.0",
  "supported_sdk_major_versions": [1],
  "client_requirements": ["client.platform", "client.os_version", "client.app_version"],
  "server_time": "2026-02-20T18:00:00.000000+00:00"
}
```

Recommended client behavior:

- Block startup if SDK major version is unsupported.
- Block startup if SDK version is below `minimum_sdk_version`.
- Keep backward compatibility if endpoint returns `404` (older backend).

---

## 5. WebSocket Chat Protocol

This is the primary communication channel.

### Connection

```
ws://<host>/v1/sessions/{session_id}/ws?api_key=iaa_<key>
```

### Envelope format

Every message in **both directions** uses this envelope:

```json
{
  "type": "<message_type>",
  "request_id": "<optional client-assigned correlation ID>",
  "payload": { ... },
  "timestamp": "2026-02-19T10:00:00.000000+00:00"
}
```

### Client → Server messages

#### `chat_message`

Send a user message to start a new agent turn.

```json
{
  "type": "chat_message",
  "request_id": "req-001",
  "payload": {
    "text": "Turn on the bedroom lights"
  },
  "timestamp": "2026-02-19T10:00:00Z"
}
```

- `text` is required and must be non-empty after trimming.
- Only **one turn** may be in-flight at a time. Sending another `chat_message` while a turn is running returns a `turn_in_progress` error.

#### `tool_result`

Return the result of a function the server asked the SDK to execute.

```json
{
  "type": "tool_result",
  "payload": {
    "call_id": "chatcmpl-abc-0",
    "status": "success",
    "result": { "brightness": 100 }
  },
  "timestamp": "2026-02-19T10:00:01Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `call_id` | string | Must match the `call_id` from the `tool_call_request`. |
| `status` | string | `"success"` or `"error"`. |
| `result` | any | Function return value. Used when `status` is `"success"`. Can be any JSON type — objects/arrays are stringified before sending to the LLM. |
| `error` | string | Error description. Used when `status` is `"error"`. |

#### `ping`

Keepalive. No payload required.

```json
{ "type": "ping", "payload": {} }
```

### Server → Client messages

#### `assistant_text_delta`

Streamed incrementally as the LLM generates text.

```json
{
  "type": "assistant_text_delta",
  "payload": {
    "delta": "The bedroom",
    "accumulated": "The bedroom"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `delta` | string | New text chunk since the last delta. |
| `accumulated` | string | Full text generated so far in this turn. |

#### `tool_call_request`

The LLM wants the SDK to execute a function on-device.

```json
{
  "type": "tool_call_request",
  "payload": {
    "call_id": "chatcmpl-abc-0",
    "function_name": "setLights",
    "arguments": { "room": "bedroom", "on": true },
    "timeout_seconds": 30
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `call_id` | string | Unique ID for this call. Must be echoed back in `tool_result`. |
| `function_name` | string | Matches a registered function `name`. |
| `arguments` | object | Parsed arguments from the LLM, matching the function's `parameters_schema`. |
| `timeout_seconds` | int | Server will time out if the SDK doesn't respond within this window. |

Multiple `tool_call_request` messages may arrive in rapid succession if the LLM requests parallel function calls. The SDK should execute them concurrently and return each `tool_result` independently.

#### `turn_complete`

Signals the end of an agent turn. No more deltas or tool calls will follow for this turn.

```json
{
  "type": "turn_complete",
  "payload": {
    "full_text": "The bedroom lights are now on.",
    "usage": {
      "prompt_tokens": 342,
      "completion_tokens": 18
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `full_text` | string | Complete assistant response for the turn. |
| `usage` | object or null | Token usage from the LLM. May be `null` depending on provider. |

#### `error`

```json
{
  "type": "error",
  "payload": {
    "code": "llm_error",
    "message": "Rate limit exceeded",
    "recoverable": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Machine-readable error code (see [Error Codes](#7-error-codes)). |
| `message` | string | Human-readable description. |
| `recoverable` | bool | `true` — SDK can send another `chat_message`. `false` — session is terminal, open a new one. |

#### `pong`

Response to `ping`. Empty payload.

---

## 6. HTTP SSE Chat (Fallback)

For environments where WebSocket is unavailable.

### Send a message

```
POST /v1/sessions/{session_id}/messages
Authorization: Bearer iaa_<key>
Content-Type: application/json
```

```json
{ "text": "Turn on the bedroom lights" }
```

**Response:** `200 OK` with `Content-Type: text/event-stream`

The SSE stream emits the same event types as WebSocket server→client messages:

```
event: assistant_text_delta
data: {"delta": "The", "accumulated": "The"}

event: tool_call_request
data: {"call_id": "tc-1", "function_name": "setLights", "arguments": {"room": "bedroom", "on": true}, "timeout_seconds": 30}

event: turn_complete
data: {"full_text": "Done.", "usage": {"prompt_tokens": 100, "completion_tokens": 10}}
```

The stream terminates after `turn_complete` or `error`.

### Submit tool results (SSE mode)

When a `tool_call_request` arrives over SSE, the SDK must POST the result to a separate endpoint while the SSE stream remains open:

```
POST /v1/sessions/{session_id}/tool-results
Authorization: Bearer iaa_<key>
Content-Type: application/json
```

```json
{
  "call_id": "tc-1",
  "status": "success",
  "result": { "brightness": 100 }
}
```

**Response:** `200 OK` — `{"status": "ok"}`

**Important:** The SSE stream and tool-result POST are tightly coupled to the same server process. If the SSE connection drops, the pending tool call is lost.

**Error responses:**

| Status | Condition |
|--------|-----------|
| `404` | Session not found or belongs to a different app. |
| `400` | Agent not configured for this app. |
| `410` | Session expired. |
| `404` (tool-results) | No pending tool call with this `call_id`. |

---

## 7. Orchestrator Flow

Before each turn, the backend computes eligible tools for the current session:

- Active + platform/OS/app-version compatible
- Required entitlements present
- Required capabilities present

Only eligible tools are passed to the LLM.

This is what happens inside the server after the SDK sends a `chat_message`:

```
┌─ 1. Persist user message to DB
│
├─ 2. Update session.last_activity_at
│
├─ 3. Load last N messages from DB (default: 100)
│     Includes: user, assistant, tool_call, tool_result
│
├─ 4. Build LLM request
│     - System prompt (from AgentConfig)
│     - Message history
│     - Tool definitions (from active RegisteredFunctions)
│
├─ 5. Call LLM (streaming, tool_choice=auto)
│
├─ 6. Process streaming response:
│     ├─ Text chunks → emit assistant_text_delta to SDK
│     └─ Tool calls → accumulate until stream ends
│
├─ 7a. Text-only response (no tool calls):
│      ├─ Persist assistant message
│      └─ Emit turn_complete → DONE
│
└─ 7b. Tool calls present:
       ├─ Persist tool_call message
       ├─ For each tool call:
       │   ├─ Unknown function → persist error result, skip
       │   └─ Known function → emit tool_call_request to SDK
       │
       ├─ Await tool_result for each call (with per-function timeout)
       │   ├─ Success → persist result
       │   └─ Timeout → persist timeout error
       │
       ├─ Increment tool_round counter
       │
       ├─ If tool_round < max_tool_rounds (default 10):
       │   └─ Go to step 3 (next LLM call with results in context)
       │
       └─ If tool_round >= max_tool_rounds:
           └─ Emit error (code: max_tool_rounds, recoverable: false)
```

Key details:

- The LLM may chain multiple rounds of tool calls before producing a final text response. Each round repeats steps 3–7.
- Multiple tool calls in a single round are sent to the SDK individually. The server awaits each result before proceeding.
- If a function name is unknown (not registered or inactive), the server automatically provides an error result to the LLM without involving the SDK.

---

## 8. Error Codes

| Code | Context | Recoverable | Description |
|------|---------|-------------|-------------|
| `auth_failed` | WS close `4001` | — | API key invalid or missing. |
| `session_not_found` | WS close `4004` | — | Session ID not found or belongs to another app. |
| `no_config` | WS close `4002` | — | Agent not configured for this app (no AgentConfig record). |
| `session_expired` | WS close `4003` / mid-turn | no | Session TTL exceeded. |
| `invalid_json` | WS frame | yes | Malformed JSON in client frame. |
| `empty_message` | WS frame | yes | `chat_message` with empty or whitespace-only text. |
| `turn_in_progress` | WS frame | yes | New `chat_message` sent while a turn is still running. |
| `agent_error` | WS frame | yes | Uncaught exception from the orchestrator. |
| `llm_error` | WS frame | yes | LLM API call failed (auth, rate limit, etc). |
| `max_tool_rounds` | WS frame | no | LLM exceeded `max_tool_rounds` without producing a final text response. |

### WebSocket close codes

| Code | Meaning |
|------|---------|
| `4001` | Authentication failed. |
| `4002` | Agent not configured. |
| `4003` | Session expired. |
| `4004` | Session not found. |

---

## 9. Timeouts & Reconnection

### Tool call timeout

Each registered function has a `timeout_seconds` value (default 30). If the SDK doesn't return a `tool_result` within that window:

- The server persists a timeout error result: `{"error": "Function 'X' timed out after Ns"}`
- The LLM sees the timeout as context and decides how to proceed (it may retry, try an alternative, or inform the user).
- No explicit error frame is sent to the SDK for individual timeouts.

### WebSocket reconnection

The server does **not** maintain reconnection state across WebSocket connections. If the connection drops:

1. The server cancels the in-flight agent task.
2. Any pending tool-result futures are abandoned.
3. The session and all persisted messages remain in the DB.

**On reconnect:**

- Open a new WebSocket to the **same session ID** (if not expired).
- The agent will resume from the persisted message history.
- Any interrupted tool call will not be retried automatically — the LLM will reconsider from the persisted context on the next `chat_message`.

### Session TTL

Default: 60 minutes of inactivity. The clock resets on every `chat_message`. After expiry, the session returns `session_expired` on any new interaction. Create a new session to continue.

---

## 10. Complete Interaction Sequence

### Typical flow (WebSocket)

```
SDK                                              Server
 │                                                  │
 │── PUT /v1/functions/bulk ──────────────────────▶│  (app launch)
 │◀── 200 [{id, name, ...}, ...] ─────────────────│
 │                                                  │
 │── POST /v1/sessions ───────────────────────────▶│  (user opens chat)
 │◀── 201 {id, ws_url, ...} ──────────────────────│
 │                                                  │
 │── WS connect ?api_key=iaa_... ─────────────────▶│
 │◀── (connection accepted) ───────────────────────│
 │                                                  │
 │── {type: "chat_message",                         │
 │    payload: {text: "Turn on the lights"}} ─────▶│
 │                                                  │── persist user msg
 │                                                  │── call LLM (stream)
 │◀── {type: "assistant_text_delta",                │
 │     payload: {delta: "Let me", accumulated: "Let me"}}
 │◀── ... (more deltas) ──────────────────────────│
 │                                                  │── LLM requests tool
 │◀── {type: "tool_call_request",                   │
 │     payload: {call_id: "tc-1",                   │
 │               function_name: "setLights",        │
 │               arguments: {room:"bedroom",on:true},│
 │               timeout_seconds: 30}} ────────────│
 │                                                  │
 │   [SDK executes setLights locally]               │
 │                                                  │
 │── {type: "tool_result",                          │
 │    payload: {call_id: "tc-1",                    │
 │              status: "success",                  │
 │              result: {brightness: 100}}} ──────▶│
 │                                                  │── persist result
 │                                                  │── call LLM again
 │◀── {type: "assistant_text_delta", ...} ─────────│
 │◀── {type: "turn_complete",                       │
 │     payload: {full_text: "The bedroom lights...",│
 │               usage: {prompt_tokens: 342,        │
 │                        completion_tokens: 18}}} ─│
 │                                                  │
 │   [User can send another chat_message]           │
 │                                                  │
 │── {type: "ping"} ──────────────────────────────▶│
 │◀── {type: "pong"} ─────────────────────────────│
```

### Error handling flow

```
SDK                                              Server
 │                                                  │
 │── {type: "chat_message",                         │
 │    payload: {text: "Do something"}} ───────────▶│
 │                                                  │── LLM requests tool
 │◀── {type: "tool_call_request",                   │
 │     payload: {call_id: "tc-2",                   │
 │               function_name: "doThing", ...}} ──│
 │                                                  │
 │   [Function fails locally]                       │
 │                                                  │
 │── {type: "tool_result",                          │
 │    payload: {call_id: "tc-2",                    │
 │              status: "error",                    │
 │              error: "Bluetooth unavailable"}} ─▶│
 │                                                  │── LLM sees error
 │                                                  │── responds gracefully
 │◀── {type: "turn_complete",                       │
 │     payload: {full_text: "I couldn't do that     │
 │               because Bluetooth is unavailable.  │
 │               Please check your settings."}} ───│
```

### Typical flow (HTTP SSE)

```
SDK                                              Server
 │                                                  │
 │── POST /v1/sessions/{id}/messages ─────────────▶│
 │   {text: "Turn on lights"}                       │
 │◀── SSE stream opens ───────────────────────────│
 │◀── event: assistant_text_delta                   │
 │◀── event: tool_call_request                      │
 │     {call_id: "tc-1", function_name: "setLights"}│
 │                                                  │
 │── POST /v1/sessions/{id}/tool-results ─────────▶│  (concurrent with SSE)
 │   {call_id: "tc-1", status: "success", ...}      │
 │◀── 200 {"status": "ok"} ───────────────────────│
 │                                                  │
 │◀── event: assistant_text_delta (on SSE stream)   │
 │◀── event: turn_complete ────────────────────────│
 │   [SSE stream closes]                            │
```
