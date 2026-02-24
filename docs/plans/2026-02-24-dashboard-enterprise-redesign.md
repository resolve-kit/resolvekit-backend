# Dashboard Enterprise Redesign

**Date:** 2026-02-24
**Status:** Approved
**Scope:** Approach B — Config tabs + sidebar nav + audit log

## Context

The Playbook dashboard is a multi-tenant SaaS product. Developer accounts each manage one or more iOS apps. The current dashboard has real bugs (session race conditions, silent error states), a layout that won't scale beyond the current nav items, a monolithic LLM config form with no feedback loop, and no audit trail.

This design addresses all of that without over-engineering. Config versioning and live WebSocket session viewing are explicitly deferred to a phase 2.

---

## 1. Layout & Navigation

### Change

Replace the per-page pill nav (`AppNav`) with a **persistent left sidebar** at the app level. The global top nav remains unchanged.

### Structure

```
┌──────────────────────────────────────────────────────┐
│ [Playbook]                   [email]    [Sign out]   │  ← top nav (unchanged)
├─────────────┬────────────────────────────────────────┤
│             │                                        │
│  ← Apps     │  [page content]                        │
│             │                                        │
│  Agent      │                                        │
│  LLM        │                                        │
│  Limits     │                                        │
│             │                                        │
│  Functions  │                                        │
│  Sessions   │                                        │
│  API Keys   │                                        │
│  Playbooks  │                                        │
│             │                                        │
│  Audit Log  │                                        │
│             │                                        │
└─────────────┴────────────────────────────────────────┘
```

### Details

- Sidebar appears when the route is under `/apps/:id/...`
- "← Apps" link returns to the app list
- Active sidebar item is highlighted
- Sidebar items with unsaved changes show a small yellow dot
- On small screens the sidebar collapses to icon-only with tooltips
- `AppNav` component is retired; `Layout` gains a conditional sidebar slot

---

## 2. AppConfig: Split Into Three Independent Pages

### Motivation

The current single-form PUT replaces every config field in one request. One temperature change overwrites the system prompt. There is no dirty-state tracking, no test-connection feedback, and `nexos` is hardcoded in the component.

### Routes

| Route | Sidebar label | Fields saved |
|---|---|---|
| `/apps/:id/agent` | Agent | `system_prompt` |
| `/apps/:id/llm` | LLM | `llm_provider`, `llm_model`, `llm_api_key`, `llm_api_base` |
| `/apps/:id/limits` | Limits | `temperature`, `max_tokens`, `max_tool_rounds`, `session_ttl_minutes`, `max_context_messages` |

Each page issues a partial PUT with only its own fields. The backend already accepts partial updates.

### Agent page

- Textarea for system prompt
- Character count
- "Unsaved changes" banner when local state differs from fetched state
- Single "Save" button

### LLM page

```
Provider          Model
[Anthropic ▼]     [claude-sonnet-4-5 ▼]   ← live list if key set; free-text fallback

API Key                      [● Set — enter to rotate]
[••••••••••••••••••••]

API Base URL   (shown for providers that declare custom_base_url: true in provider list)
[https://...]

──────────────────────────────────────────────
[Test Connection]              [Save LLM Config]
```

**Test Connection:**
- New backend endpoint: `POST /v1/apps/:id/config/test`
- Sends a minimal zero-token ping to the configured provider
- Returns `{ ok: bool, latency_ms: int, error: string | null }`
- Shown inline below the form: green "Connected · 340 ms" or red "Auth failed: invalid API key"
- Does not save anything

**Provider data-driven:** `custom_base_url` flag comes from the providers API response. No provider names hardcoded in the component.

**Dirty state:** tracked per-page. Navigating away with unsaved changes shows a confirm dialog.

### Limits page

- Temperature: slider (0.0–2.0) + number input side by side
- Max Tokens, Max Tool Rounds, Session TTL, Max Context Messages: number inputs
- Single "Save" button

---

## 3. Sessions: Robustness + Rich Viewer

### Bugs fixed

| Bug | Fix |
|---|---|
| No AbortController — switching sessions fast leaves stale data | Each session click creates a new AbortController; previous signal aborted |
| Silent error — failed message load shows stale data | Explicit `error` state; inline "Error loading messages · Retry" shown |
| All sessions loaded at once | Cursor-based pagination, 25 per page, "Load more" appends |

### Page layout

```
Sessions                          [Search...]  [Status: All ▼]  [Refresh]

┌──────────────────┬──────────────────────────────────────────────────┐
│ Session list     │ Message pane                                     │
│ (1/3)            │ (2/3)                                            │
│                  │                                                  │
│ ● abc12345       │ Session abc12345...def   ● active                │
│   active         │ iOS 18.2 · SDK 1.2 · App 2.1.0                  │
│   iPhone · 2m    │ device: iPhone-XYZ-123                           │
│                  │ ──────────────────────────────────────────────── │
│ ○ def45678       │                                                  │
│   closed · 1h    │ user      "Book me a table for 2"                │
│                  │                                                  │
│ ○ ghi78901       │ tool   → getRestaurants                          │
│   expired · 3h   │         {cuisine: "japanese", location: "NYC"}   │
│                  │         ← [{name: "Nobu"...}]  [expand]         │
│ [Load more]      │                                                  │
│                  │ assistant "I found Nobu available at 7pm..."     │
└──────────────────┴──────────────────────────────────────────────────┘
```

### Key additions

- **Search:** filter by device_id prefix (client-side against loaded sessions)
- **Status filter:** All / Active / Closed / Expired
- **Session metadata header:** surfaces `client_context` fields already stored in DB — platform, OS version, SDK version, app version
- **Tool call rendering:** collapsible card showing function name, input args, and result. Raw JSON collapsed by default, expandable. Replaces the current `JSON.stringify` dump.
- **Active session polling:** sessions with `status: active` auto-refresh the message list every 10 seconds (simple interval, cleared on unmount or session switch)
- **Load more:** appends next 25 sessions; does not replace existing list

---

## 4. Audit Log

### Backend

**New table:**

```sql
CREATE TABLE audit_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id       UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  actor_email  TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  entity_id    TEXT,
  entity_name  TEXT,
  diff         JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_events_app_id_created ON audit_events(app_id, created_at DESC);
```

**New endpoint:**

```
GET /v1/apps/:id/audit-events?limit=50&cursor=<created_at>&type=<event_type>
→ { events: [...], next_cursor: "..." | null }
```

**Event types and when they are written:**

| Event type | Trigger |
|---|---|
| `config.llm.updated` | PUT /config — LLM fields changed |
| `config.prompt.updated` | PUT /config — system_prompt changed |
| `config.limits.updated` | PUT /config — limits fields changed |
| `apikey.created` | POST /api-keys |
| `apikey.revoked` | DELETE /api-keys/:id |
| `function.activated` | PATCH /functions/:id — is_active true |
| `function.deactivated` | PATCH /functions/:id — is_active false |
| `function.override_set` | PATCH /functions/:id — description_override changed |

Events are written in the service layer, not middleware. The `diff` JSONB is computed by the service before persisting (compares old config to new; never stores raw API key values — only a boolean `api_key_rotated: true`).

### Dashboard page `/apps/:id/audit`

```
Audit Log                              [Type: All ▼]    [Export CSV]

Feb 24, 2026

  14:32  config.llm.updated     dev@company.com
         provider: anthropic → openai
         model: claude-sonnet-4-5 → gpt-4o              [expand diff]

  13:10  apikey.revoked         dev@company.com
         "Production iOS"

Feb 23, 2026

  09:05  function.deactivated   dev@company.com
         getRestaurants

[Load more]
```

- Grouped by calendar day
- Config events expand to show before/after diff inline
- Type filter: All / Config / API Keys / Functions
- Export CSV: downloads currently visible events
- Cursor-based pagination, 50 per page

---

## 5. API Client Hardening

### Changes to `api/client.ts`

**Structured error type:**
```ts
export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}
```
Eliminates the repeated `err instanceof Error ? err.message : "..."` pattern. All pages catch `ApiError` and access `err.detail` directly.

**AbortController support:**
```ts
export async function api<T>(path: string, options: RequestInit & { signal?: AbortSignal } = {}): Promise<T>
```
Callers pass `controller.signal`; the function threads it through to `fetch`.

**401 handling:** Instead of `window.location.href = "/login"` (which destroys router state), dispatch a custom DOM event `"auth:expired"` that the app root listens to and handles via `navigate("/login")`.

**No retry logic added** — retries on mutation endpoints are dangerous. Callers handle errors explicitly.

---

## What Is Explicitly Out of Scope

- Config versioning / rollback (phase 2)
- Live WebSocket session viewer in dashboard (phase 2)
- RBAC / multi-user per account (phase 2)
- Webhook configuration UI
- Usage metrics / cost tracking

---

## Files Affected

### New files
- `dashboard/src/components/AppSidebar.tsx`
- `dashboard/src/pages/AgentPrompt.tsx`
- `dashboard/src/pages/LlmConfig.tsx`
- `dashboard/src/pages/LimitsConfig.tsx`
- `dashboard/src/pages/AuditLog.tsx`
- `ios_app_agent/routers/audit.py`
- `ios_app_agent/models/audit_event.py`
- `alembic/versions/<hash>_add_audit_events.py`

### Modified files
- `dashboard/src/components/Layout.tsx` — sidebar slot
- `dashboard/src/pages/Sessions.tsx` — pagination, AbortController, metadata, tool rendering
- `dashboard/src/pages/AppConfig.tsx` — deleted (replaced by three new pages)
- `dashboard/src/api/client.ts` — ApiError, signal, 401 event
- `dashboard/src/main.tsx` — new routes, auth:expired listener
- `ios_app_agent/routers/config.py` — add test endpoint, wire audit events
- `ios_app_agent/routers/functions.py` — wire audit events
- `ios_app_agent/routers/api_keys.py` — wire audit events
- `ios_app_agent/services/orchestrator.py` — no change
- `ios_app_agent/main.py` — mount audit router
