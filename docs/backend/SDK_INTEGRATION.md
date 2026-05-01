# SDK Integration Guide

This document describes the ResolveKit SDK-to-backend integration contract, including all endpoints, request/response schemas, and authentication flows.

## Authentication Model

The SDK integration uses a **two-tier authentication** model:

1. **SDK API Key** — Used for session creation, function registration, and compatibility checks. Sent via the `x-sdk-api-key` header.
2. **Chat Capability Token** — A short-lived JWT issued when creating a session (returned as `chat_capability_token` in the session creation response). Used for chat message posting, event streaming, tool result submission, context patching, and localization. Sent via the `x-chat-capability-token` header.
3. **Client Token** — A JWT issued via `POST /v1/sdk/client-token` using API key auth, with configurable TTL (default 900s via `IAA_SDK_CLIENT_TOKEN_TTL_SECONDS`) and rate limiting (default 60/min via `IAA_SDK_CLIENT_TOKEN_RATE_LIMIT_PER_MINUTE`).

## Endpoints

### POST /v1/sessions — Create Session

Creates a new chat session or reuses an existing active session.

**Auth:** SDK API Key (`x-sdk-api-key`)

**Request Body:** `SessionCreate`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `device_id` | `string | null` | No | Unique device identifier |
| `client` | `SessionClientInfo | null` | No | Client metadata sub-object |
| `llm_context` | `object` | No | Context data for LLM (max 50 keys, 8192 bytes) |
| `available_function_names` | `string[]` | No | Registered function names (max 512) |
| `locale` | `string | null` | No | Preferred locale code |
| `preferred_locales` | `string[]` | No | Fallback locale list (max 20) |
| `reuse_active_session` | `bool` | No | Reuse existing active session (default: `true`) |

**`client` sub-object fields (`SessionClientInfo`):**

| Field | Type | Max Length | Description |
| --- | --- | --- | --- |
| `platform` | `string | null` | 32 | Platform identifier (e.g., "ios", "android") |
| `os_name` | `string | null` | 32 | Operating system name |
| `os_version` | `string | null` | 64 | OS version string |
| `app_version` | `string | null` | 64 | Application version |
| `app_build` | `string | null` | 64 | Application build number |
| `sdk_name` | `string | null` | 64 | SDK package name |
| `sdk_version` | `string | null` | 64 | SDK version string |

**Response:** `SessionOut` (201 Created)

Includes `chat_capability_token` for subsequent chat requests, `events_url` for SSE stream, and `reused_active_session` flag.

### PATCH /v1/sessions/{session_id}/context — Update Session Context

Updates session context fields mid-conversation (client info, LLM context, function list, locale).

**Auth:** Chat Capability Token (`x-chat-capability-token`)

**Request Body:** `SessionContextPatch`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `client` | `SessionClientInfo | null` | No | Updated client metadata |
| `llm_context` | `object | null` | No | Updated LLM context (max 50 keys, 8192 bytes) |
| `available_function_names` | `string[]` | No | Updated function list (max 512) |
| `locale` | `string | null` | No | Updated locale code |

**Response:** `SessionContextOut` (200 OK)

### GET /v1/functions — List Functions

Lists all active registered functions for the app.

**Auth:** SDK API Key (`x-sdk-api-key`)

**Response:** `list[FunctionOut]` (200 OK)

### GET /v1/functions/eligible — Get Eligible Functions

Returns functions eligible for the current session based on function availability rules.

**Auth:** SDK API Key (`x-sdk-api-key`)

**Query Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `session_id` | `uuid` | Yes | Session identifier |

**Response:** `list[FunctionOut]` (200 OK)

### POST /v1/sdk/client-token — Issue Client Token

Issues a short-lived client token for SDK authentication. Uses API key auth with rate limiting.

**Auth:** SDK API Key (`x-sdk-api-key`)

**Rate Limiting:** 60 requests/minute per app+client host (configurable via `IAA_SDK_CLIENT_TOKEN_RATE_LIMIT_PER_MINUTE`). Returns 429 if exceeded.

**Response:** `SDKClientTokenResponse` (200 OK)

| Field | Type | Description |
| --- | --- | --- |
| `token` | `string` | Signed JWT token |
| `expires_at` | `datetime` | Token expiration timestamp |

**Headers:** Response includes `Cache-Control: no-store`, `Pragma: no-cache`, `Vary: Origin`.

### GET /v1/pricing/model — Get Pricing Model

Looks up pricing information for a given LLM provider and model.

**Auth:** None (public endpoint)

**Query Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `provider` | `string` | Yes | Provider name (max 64 chars) |
| `model` | `string` | Yes | Model name (max 200 chars) |

**Response:** `ModelPricingLookupOut` (200 OK)

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `string` | Resolved provider name |
| `model` | `string` | Resolved model name |
| `pricing` | `object` | Pricing details |

### GET /v1/sdk/compat — SDK Compatibility Check

Returns minimum SDK version and supported major versions.

**Auth:** SDK API Key (`x-sdk-api-key`)

**Response:** `SDKCompatResponse` (200 OK)

| Field | Type | Description |
| --- | --- | --- |
| `minimum_sdk_version` | `string` | Minimum required SDK version |
| `supported_sdk_major_versions` | `int[]` | List of supported major version numbers |
| `client_requirements` | `string[]` | Required client fields (e.g., `client.platform`, `client.os_version`, `client.app_version`) |
| `server_time` | `string` | ISO 8601 server timestamp |

## SSE Event Stream

The event stream is delivered via **Server-Sent Events (SSE)** at `GET /v1/sessions/{session_id}/events`, not WebSocket. The response uses `text/event-stream` content type.

**Auth:** Chat Capability Token (`x-chat-capability-token`)

## Schema Reference

### SessionCreate

```json
{
  "device_id": "device-123",
  "client": {
    "platform": "ios",
    "os_name": "iOS",
    "os_version": "17.4",
    "app_version": "2.1.0",
    "app_build": "42",
    "sdk_name": "resolvekit-ios",
    "sdk_version": "1.4.2"
  },
  "llm_context": {"user_tier": "premium"},
  "available_function_names": ["get_order_status", "cancel_order"],
  "locale": "en",
  "preferred_locales": ["en", "es"],
  "reuse_active_session": true
}
```

### SessionOut

```json
{
  "id": "uuid",
  "app_id": "uuid",
  "device_id": "device-123",
  "client_context": {...},
  "llm_context": {...},
  "available_function_names": ["get_order_status"],
  "locale": "en",
  "chat_title": "Chat",
  "message_placeholder": "Message",
  "initial_message": "Hello! How can I help you today?",
  "status": "active",
  "last_activity_at": "2026-05-01T12:00:00Z",
  "created_at": "2026-05-01T12:00:00Z",
  "events_url": "/v1/sessions/{id}/events",
  "chat_capability_token": "jwt-token-here",
  "reused_active_session": false
}
```

### SDKCompatResponse

```json
{
  "minimum_sdk_version": "1.0.0",
  "supported_sdk_major_versions": [1],
  "client_requirements": ["client.platform", "client.os_version", "client.app_version"],
  "server_time": "2026-05-01T12:00:00+00:00"
}
```

### SDKClientTokenResponse

```json
{
  "token": "jwt-token-here",
  "expires_at": "2026-05-01T12:15:00Z"
}
```
