# SDK Capabilities Reference

Definitive reference for every feature offered by the ResolveKit SDK platform. Use this when building a new client SDK, auditing feature parity, or understanding the backend contract for a specific feature.

**Status legend:** ✅ Implemented · ⚠️ Partial · ❌ Missing · N/A Not applicable to this platform

For exact request/response schemas use the generated OpenAPI contracts:
- [`agent.openapi.json`](../generated/openapi/agent.openapi.json)
- [`dashboard.openapi.json`](../generated/openapi/dashboard.openapi.json)

---

## 1. SDK Initialization & Configuration

Every SDK client must accept these configuration fields:

| Field | Required | Backend destination |
|-------|----------|---------------------|
| `api_key` | Yes | `Authorization: Bearer` header on all requests |
| `base_url` | No (default: localhost:8000) | Root for all API calls |
| `device_id` | No | `POST /v1/sessions` → `device_id` |
| `llm_context` | No | `POST /v1/sessions` → `llm_context` |
| `entitlements` | No | `POST /v1/sessions` → `entitlements` |
| `capabilities` | No | `POST /v1/sessions` → `capabilities` |
| `locale` | No | `POST /v1/sessions` → `locale` |
| `preferred_locales` | No | `POST /v1/sessions` → `preferred_locales` (fallback list) |
| `client` | No | `POST /v1/sessions` → `client` (platform/os/app/sdk versions) |
| `functions` | No | `PUT /v1/functions/bulk` after session start |

- **Client context** (`platform`, `os_name`, `os_version`, `app_version`, `sdk_name`, `sdk_version`): iOS ✅ · Web ✅
- **Preferred locales** (ordered fallback list from system): iOS ✅ · Web ✅
---

## 2. Function Authoring

Functions let the AI execute actions in the host app. Registered via `PUT /v1/functions/bulk`.

**Wire format per function:**

```json
{
  "name": "snake_case_identifier",
  "description": "Plain-English description the LLM uses to decide when to call this.",
  "parameters_schema": { "type": "object", "properties": {...}, "required": [...] },
  "timeout_seconds": 30,
  "requires_approval": true,
  "source": "app_inline",
  "pack_name": null
}
```

- `name` must match `^[a-z][a-z0-9_]*$`
- `parameters_schema` is a JSON Schema `object` node; supported leaf types: `string`, `number`, `boolean`, `object`, `array`
- Optional parameters must be absent from the `required` array
- `requires_approval` default is `true`; set `false` for read-only / non-destructive functions

**SDK implementations:**
- iOS: `@ResolveKit` macro (generates schema + dispatch) + `AnyPlaybookFunction` protocol ✅
- Web: `fn()` helper with camelCase → snake_case name inference ✅

---

## 3. Function Packs & Availability Gating

Functions can be grouped into packs and conditionally registered based on platform, OS/app version, entitlements, and capabilities. Backend filters via [`GET /v1/functions/eligible`](../../agent/routers/functions.py).

**Additional wire fields per function:**

```json
{
  "source": "playbook_pack",
  "pack_name": "commerce_pack",
  "availability": {
    "platforms": ["ios", "macos"],
    "min_os_version": "17.0",
    "max_os_version": null,
    "min_app_version": "2.0",
    "max_app_version": null
  },
  "required_entitlements": ["pro"],
  "required_capabilities": ["camera"]
}
```

- Supported platforms: `ios`, `macos`, `tvos`, `watchos`, `visionos`, `web`
- iOS: `PlaybookFunctionPack` protocol — groups functions by `packName`, filters by `supportedPlatforms` ✅
- Web: ❌ All functions registered unconditionally; no availability or gating fields sent

---

## 4. Session Management

**Requirement (all SDKs):**
- Session persistence across widget/view reopen is mandatory.
- Reconnection to an existing active session is mandatory (same `session_id` when reusable).
- On reused sessions, the SDK must restore message history before resuming live transport.

**Start a session:** `POST /v1/sessions`

Key request fields: `device_id`, `llm_context`, `entitlements`, `capabilities`, `locale`, `preferred_locales`, `client`, `reuse_active_session: true`

**Response fields:**

| Field | Notes |
|-------|-------|
| `session_id` | Use in all subsequent session-scoped calls |
| `capability_token` | JWT; send as `x-chat-capability-token` header |
| `reused_active_session` | `true` → load message history |
| `chat_title` | Locale-aware title for the chat header |
| `message_placeholder` | Locale-aware composer placeholder |
| `initial_message` | Greeting message to display on first open |

- **Initial message rendering**: iOS ✅ · Web ✅
- **Client context** (platform/OS/app/SDK versions): iOS ✅ · Web ✅
- **Session reuse + history restore on reopen**: iOS ✅ · Web ✅
- **Persistent device identity (for reuse lookup)**: iOS ✅ · Web ✅

---

## 5. Connection & Transport

### WebSocket (primary)

1. `POST /v1/sessions/{id}/ws-ticket` → one-time ticket (short-lived, single-use)
2. Connect: `wss://host/v1/sessions/{id}/ws?ticket={ticket}&chat_capability={token}`
3. Ping every 30s to keep connection alive

### SSE fallback

Activate when WebSocket is unavailable:

- `POST /v1/sessions/{id}/messages`
- Headers: `Authorization: Bearer {api_key}` + `x-chat-capability-token: {token}`
- Body: `{ "text": "...", "locale": "en" }`
- Response: `text/event-stream` — each frame: `event: {type}\ndata: {json}\n\n`

### Tool results

- Via WS: send `tool_result` envelope
- Via REST: `POST /v1/sessions/{id}/tool-results` with same auth headers

### Connection state machine

A complete SDK implements these states:

| State | Meaning |
|-------|---------|
| `idle` | Not started |
| `registering` | Calling `PUT /v1/functions/bulk` |
| `connecting` | Minting WS ticket, opening socket |
| `active` | WebSocket connected and streaming |
| `reconnected` | Reconnected after transient disconnect |
| `fallback_sse` | WebSocket unavailable; using SSE |
| `blocked` | API key missing or SDK version incompatible |
| `failed` | Unrecoverable error |

- iOS implements all 8 states ✅
- Web implements all 8 states ✅
- **Auto-reconnect** before falling back to SSE: iOS ✅ · Web ✅

---

## 6. SDK Compatibility Check

`GET /v1/sdk/compat` — call at startup before any session work (no auth required).

**Response:** `minimum_sdk_version`, `supported_sdk_major_versions`, `server_time`

**Block conditions:**
- SDK major version not in `supported_sdk_major_versions`
- SDK version below `minimum_sdk_version` (semver)
- API key absent (treat as `blocked` state)

Both SDKs ✅

---

## 7. Message History (Session Reuse)

When `reused_active_session: true` in the session response, load prior messages:

`GET /v1/sessions/{id}/messages` with `x-chat-capability-token` header

- Filter to: `role ∈ {user, assistant}` AND `content ≠ null`
- Populate the message list before opening the transport connection

Both SDKs ✅

- **Reopen behavior requirement**: reopening chat must reuse active session when available and must not silently start a new session for the same persisted device context.

---

## 8. Chat UI

### Theme

`GET /v1/sdk/chat-theme` returns a light/dark palette. Fields include `screen_background`, `user_bubble_background`, `assistant_bubble_background`, and 15+ other color tokens. Applied to the chat view on session start.

### Localization strings

`GET /v1/sessions/{id}/localization?locale={code}` returns locale-aware:
- `chat_title` — header title
- `message_placeholder` — composer placeholder
- `initial_message` — first assistant greeting

### SDK implementations

- iOS: SwiftUI `PlaybookChatView` — streaming message bubbles, tool checklist, appearance override (`setAppearance(.light/.dark/.system)`) ✅
- Web: Web Component `<playbook-chat>` — Shadow DOM, responsive (full-screen < 480px), `bottom-right`/`bottom-left` position, ARIA accessibility ✅
- **Appearance override API**: iOS ✅ · Web ✅ (`setAppearance(.light/.dark/.system)` equivalent)
- **Localization strings endpoint**: iOS ✅ · Web ✅

---

## 9. Tool Call Approval Flow

The server sends a `tool_call_request` event with `requires_approval` (boolean, default `true`).

**Routing:**

- `requires_approval: false` → execute immediately, send `tool_result`, no UI shown
- `requires_approval: true` → surface approval UI, wait for user, then execute or decline

**On decline:** send `tool_result` with `status: "error"`, `error: "User declined"`

**On timeout:** send `tool_result` with `status: "error"`, `error: "Timeout"`

### Advanced: batch coalescing

Multiple `tool_call_request` events within a 250ms window should be coalesced into a single batch presented to the user as one checklist ("Approve All / Decline All"). Each item tracks its own status independently: `pending_approval → running → completed | failed | cancelled`.

- iOS: 250ms coalescing window, `ToolCallChecklistBatch`, per-item status ✅
- Web: 250ms coalescing window with batch approvals ✅

### Execution log

An ordered log of tool outcomes (success / error / declined / cancelled) for developer observability:
- iOS ✅ · Web ✅

---

## 10. DOM / Native Element Highlighting

*Web-only feature — N/A on native platforms.*

Register discoverable elements by adding `data-playbook-id="unique-id"` to HTML. Two built-in functions are auto-registered at SDK init (no developer code needed):

- `highlight_element(id: string, label?: string)` — animated pulsing border + scroll into view
- `clear_highlights()` — removes all active highlights

A `MutationObserver` watches for `data-playbook-id` attribute changes so dynamically rendered elements are automatically discoverable.

- Web ✅ · iOS N/A

---

## 11. Events & Observability

Clients must expose a way to react to state changes, new messages, and tool call lifecycle events.

| Event | iOS | Web |
|-------|-----|-----|
| State change | `@Published` properties ✅ | `statechange` via `.on()` ✅ |
| New / updated message | `@Published messages` ✅ | `message` event ✅ |
| Tool call lifecycle (started/completed/failed) | `@Published toolCallBatches` ✅ | `toolcall` event ✅ |
| Approval request | Checklist batch state ✅ | `toolapproval` via `.on()` ✅ |
| Per-tool execution log | `executionLog` ✅ | ✅ |
| Structured per-subsystem logging | `[ResolveKit][WS]` etc. ✅ | ✅ |

---

## 12. Localization

The locale flows through multiple layers:

1. **Session create**: send `locale` (resolved) + `preferred_locales` (ordered fallback list)
2. **Message envelope**: include `locale` field in `chat_message` WS payload
3. **Localization endpoint**: call `GET /v1/sessions/{id}/localization?locale={code}` for locale-aware UI strings
4. **Locale resolution**: map system locale to one of 45+ supported codes; fall back through `preferred_locales` then to `"en"`

Supported codes include: `ar`, `bg`, `bn`, `bs`, `ca`, `cs`, `da`, `de`, `el`, `en`, `en-gb`, `es`, `es-ar`, `et`, `fa`, `fi`, `fr`, `hi`, `he`, `hr`, `hu`, `id`, `it`, `ja`, `ko`, `lt`, `lv`, `ms`, `nb`, `nl`, `pl`, `pt`, `pt-br`, `ro`, `ru`, `sk`, `sq`, `sr`, `sv`, `sw`, `th`, `tl`, `tr`, `uk`, `ur`, `vi`, `zh`, `zh-cn`, `zh-tw`.

See [`Sources/PlaybookUI/PlaybookLocaleResolver.swift`](../../playbook-ios-sdk/Sources/PlaybookUI/PlaybookLocaleResolver.swift) for the canonical mapping and alias table.

- iOS: full resolver, 45+ locales, fallback chain, `preferred_locales` ✅
- Web: locale resolver + preferred locales fallback chain ✅

---

## Parity Gap Summary

### iOS has, Web lacks

| Feature | Web status |
|---------|-----------|
| Function packs (platform/version gating) | ❌ |

### Web has, iOS lacks

| Feature | iOS status |
|---------|-----------|
| DOM element highlighting (`data-playbook-id`) | N/A |
| Floating chat widget (Web Component, Shadow DOM) | N/A |
| React integration layer (Provider, hook, approval component) | N/A |
| Widget position config (`bottom-right` / `bottom-left`) | N/A |
| Web accessibility attributes (ARIA roles, labels) | N/A |

---

## Related Docs

- [iOS App Agent Capabilities](ios-app-agent-capabilities.md)
- [SDK-to-Backend Integration Map](integration-map-sdk-to-backend.md)
- [Orchestrator Flow](orchestrator-flow.md)
- [Router Map](router-map.md)
- [agent OpenAPI Contract](../generated/openapi/agent.openapi.json)
