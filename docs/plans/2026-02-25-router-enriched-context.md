# LLM Agent Pipeline: Router + Enriched Context Design

**Date:** 2026-02-25
**Status:** Approved for implementation

---

## Problem Statement

The iOS App Agent backend hosts an LLM-powered tech-support agent that iOS developers embed into their apps. End-users chat with this agent to get help with the developer's app. The agent has access to four context sources:

1. **System prompt** — developer-configurable text describing the app and agent behavior
2. **Registered functions** — on-device functions the SDK registers; the LLM can call these as tools
3. **Playbooks** — structured support workflows the developer configures in the dashboard
4. **Knowledge bases** — vector-search document collections (e.g., documentation, support articles) the developer feeds into the system

**Current problems:**

1. **No scope enforcement.** The agent can answer anything — weather questions, coding help, general trivia. It has no concept of being scoped to support a specific app. Developers expect a support agent, not a general chatbot.

2. **Lazy KB search.** The knowledge base is exposed as a `kb_search` tool. The LLM decides when to call it — and often doesn't, especially if the system prompt or conversation history seems sufficient. Pre-loaded documentation is not used proactively.

3. **All playbooks dumped into system prompt.** Every active playbook is appended as plain text on every turn, regardless of relevance. This wastes context tokens and dilutes the signal.

4. **No non-configurable base prompt.** The developer's `system_prompt` field is the only instruction source, but developers rarely define good behavior guidelines. There is no system-defined anchor for the agent's role, tone, or how to use available context sources.

5. **No guidance in the UI.** The dashboard's system prompt field has a generic placeholder. Developers don't know they're supposed to describe their app there — which is critical for scope enforcement.

---

## Current Architecture (Before)

```
Each chat turn in run_agent_loop():
  1. Load eligible functions (compatibility-filtered)
  2. Load KB assignment context (org_id + assigned KB IDs)
  3. build_playbook_prompt(db, app_id) → ALL active playbooks as text
  4. system_prompt = config.system_prompt + playbook_prompt
  5. Load last N messages from DB
  6. Build tools = [SDK functions] + [kb_search tool if KBs assigned]
  7. Call LLM(system_prompt, messages, tools)
  8. If tool_calls → execute (kb_search server-side, SDK functions sent to iOS) → loop
  9. If text → send turn_complete
```

**Key files:**
- `ios_app_agent/services/orchestrator.py` — `run_agent_loop()`, `build_playbook_prompt()`, `_load_kb_assignment_context()`, `execute_internal_kb_tool_call()`
- `ios_app_agent/services/llm_service.py` — `call_llm()`, `build_tools()`
- `ios_app_agent/services/kb_service_client.py` — HTTP client for KB service
- `ios_app_agent/models/agent_config.py` — `AgentConfig` ORM model
- `ios_app_agent/schemas/agent_config.py` — `AgentConfigUpdate`, `AgentConfigOut`
- `ios_app_agent/routers/config.py` — `config_to_out()`, `_PROMPT_FIELDS`
- `dashboard/src/pages/AppConfig.tsx` — agent config UI

---

## Design Decisions

### Decision 1: Scope enforcement mode
**Choice made:** Developer-configurable via `scope_mode` field: `"open"` (default, backward-compatible) or `"strict"` (rejects off-topic messages).

**Rationale:** Different apps have different needs — a general assistant SDK might want open mode, while a dedicated support app wants strict. Defaulting to `"open"` ensures zero breakage for existing deployments.

**Alternatives considered:**
- *Always strict* — would break existing apps that rely on general LLM answers
- *LLM-inferred from system prompt* — less predictable, harder to test

### Decision 2: App context source
**Choice made:** The developer's `system_prompt` field carries the app description. No new field added. The dashboard UI will add guidance text and a better placeholder to tell developers they must describe their app here.

**Rationale:** Developers already have a system prompt field. Adding another "app description" field creates confusion. The UI guidance solves the discoverability problem.

**Alternatives considered:**
- *New `app_description` field* — cleaner separation but more schema complexity
- *Derive from registered function names* — too fragile and indirect

### Decision 3: Architecture pattern
**Choice made:** Router + Enriched Agent (two-stage).

```
Stage 1 (Router): lightweight LLM call → scope check + KB intent
Stage 2 (Main Agent): enriched system prompt with pre-fetched context
```

**Rationale:** A full multi-agent system (orchestrator + KB agent + playbook agent + execution agent) adds latency (3-4 LLM calls per turn) and complex state management. A single enriched agent after a fast router gives most of the benefit at fraction of the cost.

**Alternatives considered:**
- *Full multi-agent* — best separation of concerns but too much latency and complexity
- *Enhanced single agent* — keeps one LLM call but doesn't fix lazy KB search or scope enforcement

### Decision 4: KB search strategy
**Choice made:** Pre-fetch KB results before the main agent runs, inject as `## Relevant Documentation` in system prompt. Keep `kb_search` tool as a fallback for iterative follow-up queries.

**Rationale:** Pre-fetching solves the "lazy KB search" problem — the LLM always sees relevant docs. Keeping the fallback tool means the LLM can search for additional context if the pre-fetched results don't fully cover a follow-up question.

**Alternatives considered:**
- *Remove the kb_search tool entirely* — cleaner but loses iterative search capability
- *Always pre-search regardless of router* — wastes KB service calls on purely conversational messages

### Decision 5: Router failure handling
**Choice made:** On any router error (LLM failure, JSON parse failure, timeout), fall back to `RouterResult(in_scope=True, needs_kb=True, kb_query=user_text)`. The main agent always proceeds.

**Rationale:** The router is a performance optimization, not a security gate. Failing open preserves the existing user experience.

---

## Target Architecture (After)

```
User Message
    ↓
[Step 1: Router — lightweight LLM call, no tools]
  Input:
    - ROUTER_SYSTEM_PROMPT (fixed, non-configurable)
    - user message
    - config.system_prompt (app context for scope check)
  Output JSON:
    {
      "in_scope": bool,
      "rejection_reason": string | null,   // user-facing if out of scope
      "needs_kb": bool,
      "kb_query": string | null,           // optimized for semantic search
      "intent": string                     // short description of request
    }
    |
    ├── strict mode + in_scope=false
    │     → persist rejection as role="assistant" message
    │     → send turn_complete(rejection_text)
    │     → return (no main agent)
    |
    ↓
[Step 2: Parallel context prefetch]
  ├── _prefetch_kb_context(kb_query)       HTTP to KB service, no DB
  │     → calls existing execute_internal_kb_tool_call()
  │     → formats results as ## Relevant Documentation block
  └── build_playbook_prompt(db, app_id)    existing function, uses DB
    ↓
[Step 3: Assemble enriched system prompt]
  1. BASE_PROMPT                           always first, non-configurable
  2. ## About This App                     developer's system_prompt
  3. ## Scope                              strict mode only
  4. ## Relevant Documentation             KB pre-search results (if any)
  5. ## Support Workflows                  playbook prompt (existing format)
    ↓
[Step 4: Main agent loop — largely unchanged]
  - Messages: load last N from DB (unchanged)
  - Tools: eligible SDK functions + kb_search fallback tool (unchanged)
  - Multi-turn tool call loop (unchanged)
    ↓
Response to user via WebSocket turn_complete or SSE event
```

---

## Code Review Notes (from pre-implementation review)

Before coding, the following was verified against the actual codebase:

1. `asyncio` and `json` are **already imported** in `orchestrator.py` (lines 1–2). Do NOT add them again.
2. `from dataclasses import dataclass` is NOT present — must be added.
3. `_load_kb_assignment_context` is called **outside** the while loop (line 186), not inside it. The plan's description of "removing it from the while loop body" is inaccurate — it's already outside. The task is to replace the standalone `await _load_kb_assignment_context(...)` call with an `asyncio.gather` that runs it in parallel with `_run_router`.
4. `build_playbook_prompt` is also called outside the while loop (line 192). It moves into the second `asyncio.gather` call.
5. KB search response: `execute_internal_kb_tool_call` returns `{"query": ..., "items": [...]}`. Use `item.get("title") or item.get("source_title")` and `item.get("content") or item.get("text")` as safe multi-field fallbacks.
6. The `Config` interface in `AppConfig.tsx` uses direct `.then(setConfig)` — add `scope_mode` to the interface and map the response with `?? "open"` fallback.
7. `_PROMPT_FIELDS` in `config.py` is used for audit diff tracking. Adding `scope_mode` causes scope_mode changes to be audited under `config.prompt.updated` — this is intentional.

---

## Complete Implementation Plan

### Step 1 — Database migration

**New file:** `alembic/versions/011_add_scope_mode_to_agent_configs.py`

Pattern: follow `010_add_app_integration_controls.py` exactly.
The column uses `server_default` so all existing rows automatically get `'open'`.

```python
"""add_scope_mode_to_agent_configs

Revision ID: 011
Revises: 010
Create Date: 2026-02-25
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        "agent_configs",
        sa.Column("scope_mode", sa.String(20), nullable=False, server_default=sa.text("'open'")),
    )

def downgrade() -> None:
    op.drop_column("agent_configs", "scope_mode")
```

---

### Step 2 — ORM model

**File:** `ios_app_agent/models/agent_config.py`

Add after `max_context_messages` (line 46), before the relationships. Use `String(20)` (not a Python `Enum`) to match the pattern used by `status` in `ChatSession` and `llm_provider` in `AgentConfig`. Validation lives in the Pydantic layer.

```python
scope_mode: Mapped[str] = mapped_column(String(20), default="open")
```

---

### Step 3 — Pydantic schemas

**File:** `ios_app_agent/schemas/agent_config.py`

Add `from typing import Literal` import (file currently has no `typing` import).

`AgentConfigUpdate` — add optional field:
```python
scope_mode: Literal["open", "strict"] | None = None
```

`AgentConfigOut` — add required field:
```python
scope_mode: str
```

---

### Step 4 — Config router

**File:** `ios_app_agent/routers/config.py`

Two small changes:

1. Line 33 — add `"scope_mode"` to `_PROMPT_FIELDS`:
   ```python
   _PROMPT_FIELDS = {"system_prompt", "scope_mode"}
   ```

2. `config_to_out()` (line 98) — add to the `AgentConfigOut(...)` call:
   ```python
   scope_mode=cfg.scope_mode,
   ```

No change needed to `update_config()` — the existing `setattr` loop handles any new field in `AgentConfigUpdate`.

---

### Step 5 — Orchestrator (core change)

**File:** `ios_app_agent/services/orchestrator.py`

#### 5a. Imports
Add at top (after existing imports):
```python
from dataclasses import dataclass
```
NOTE: `asyncio` and `json` are already imported on lines 1–2. Do NOT add them.

#### 5b. Module-level constants (add near `KB_SEARCH_TOOL_NAME`)

```python
BASE_PROMPT = """\
You are a customer support assistant for a mobile app. Your role is to help \
users resolve issues, answer questions about the app, and guide them through \
features using the tools and documentation available to you.

Guidelines:
- Be helpful, concise, and clear. Avoid unnecessary technical jargon unless \
the user is clearly technical.
- If pre-loaded documentation appears under "## Relevant Documentation", \
treat it as your primary source for product-specific questions before drawing \
on general knowledge.
- If support workflows appear under "## Support Workflows", follow the \
relevant workflow step-by-step when the user's request matches it.
- Use the kb_search tool only for follow-up queries that require finding \
additional documentation not already in the pre-loaded context above.
- For multi-step tasks, briefly explain each step before performing it so \
the user understands what is happening.
- If you cannot resolve the issue, clearly explain what you tried and suggest \
contacting support.\
"""

ROUTER_SYSTEM_PROMPT = """\
You are a routing classifier for a customer support agent.
Analyze the user's message and return a JSON object with exactly these fields:

{
  "in_scope": <bool>,
  "rejection_reason": <string or null>,
  "needs_kb": <bool>,
  "kb_query": <string or null>,
  "intent": <string>
}

Rules:
- in_scope: true if the message relates to using, troubleshooting, or \
understanding the app described in the app context. false if it is entirely \
unrelated to the app (e.g., general knowledge, coding help for other projects, \
requests unrelated to the app's domain).
- rejection_reason: a short, polite user-facing sentence explaining why the \
message is out of scope. Only set when in_scope is false; null otherwise.
- needs_kb: true if answering would likely benefit from searching product \
documentation (how-to questions, error messages, feature questions, \
troubleshooting steps).
- kb_query: if needs_kb is true, write a focused semantic search query \
optimized for finding relevant documentation chunks. null otherwise.
- intent: one short sentence describing what the user wants.

Return only the JSON object. No markdown, no explanation.\
"""
```

#### 5c. RouterResult dataclass (add after the constants)

```python
@dataclass
class RouterResult:
    in_scope: bool
    rejection_reason: str | None
    needs_kb: bool
    kb_query: str | None
    intent: str
```

#### 5d. `_run_router()` function (add after RouterResult)

```python
async def _run_router(
    config: AgentConfig,
    user_text: str,
    session_id: uuid.UUID,
) -> RouterResult:
    """Lightweight classifier: scope check + KB pre-search intent."""
    router_messages = [
        {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"App context:\n{config.system_prompt}\n\n"
                f"User message:\n{user_text}"
            ),
        },
    ]
    try:
        response = await call_llm(config, router_messages, tools=None)
        raw = (response.choices[0].message.content or "").strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        return RouterResult(
            in_scope=bool(data.get("in_scope", True)),
            rejection_reason=data.get("rejection_reason"),
            needs_kb=bool(data.get("needs_kb", False)),
            kb_query=data.get("kb_query"),
            intent=str(data.get("intent", "")),
        )
    except Exception:
        logger.warning(
            "router_failed session_id=%s app_id=%s defaulting to open",
            session_id,
            config.app_id,
        )
        return RouterResult(
            in_scope=True,
            rejection_reason=None,
            needs_kb=True,
            kb_query=user_text,
            intent="",
        )
```

#### 5e. `_prefetch_kb_context()` function (add after `_run_router`)

```python
async def _prefetch_kb_context(
    *,
    session_id: uuid.UUID,
    app_org_id: uuid.UUID,
    assigned_kb_ids: list[uuid.UUID],
    query: str,
    top_k: int = 5,
) -> str:
    """Pre-search KB and return a formatted ## Relevant Documentation section.

    Calls the same execute_internal_kb_tool_call() used by the main agent loop.
    Returns empty string if no results or no KB assigned.
    """
    if not assigned_kb_ids or not app_org_id:
        return ""
    result = await execute_internal_kb_tool_call(
        session_id=session_id,
        app_org_id=app_org_id,
        assigned_kb_ids=assigned_kb_ids,
        arguments={"query": query, "top_k": top_k},
    )
    items = result.get("items", [])
    if not items:
        return ""
    lines = ["\n\n## Relevant Documentation"]
    for item in items:
        title = item.get("title") or item.get("source_title") or "Untitled"
        content = item.get("content") or item.get("text") or ""
        if content:
            lines.append(f"\n### {title}\n{content}")
    return "\n".join(lines)
```

#### 5f. `_assemble_system_prompt()` function (add after `_prefetch_kb_context`)

```python
def _assemble_system_prompt(
    *,
    dev_prompt: str,
    scope_mode: str,
    kb_context: str,
    playbook_prompt: str,
) -> str:
    """Assemble the full system prompt in fixed order:
    1. BASE_PROMPT (non-configurable)
    2. ## About This App (developer's system_prompt)
    3. ## Scope (strict mode only)
    4. ## Relevant Documentation (KB pre-search, may be empty)
    5. ## Support Workflows (playbooks, may be empty)
    """
    parts = [BASE_PROMPT]
    if dev_prompt.strip():
        parts.append(f"\n\n## About This App\n{dev_prompt.strip()}")
    if scope_mode == "strict":
        parts.append(
            "\n\n## Scope\nYou are only permitted to help users with questions "
            "and tasks directly related to this app. If the user asks about "
            "topics unrelated to this app, politely decline and redirect them "
            "to their app-related needs."
        )
    if kb_context:
        parts.append(kb_context)
    if playbook_prompt:
        parts.append(playbook_prompt)
    return "".join(parts)
```

#### 5g. Async no-op helper (add after `_assemble_system_prompt`)

```python
async def _noop_str() -> str:
    return ""
```

#### 5h. Modify `run_agent_loop()`

The current function (after `await update_activity(db, session.id)`) builds context with two separate awaits:
```python
# CURRENT CODE (lines 185-192):
sdk_tools = build_tools(functions) if functions else []
app_org_id, assigned_kb_ids = await _load_kb_assignment_context(db, session.app_id)
tools = list(sdk_tools)
if assigned_kb_ids:
    tools.append(_build_kb_search_tool())
tools_payload = tools or None
tool_round = 0
playbook_prompt = await build_playbook_prompt(db, session.app_id)
```

Replace those 8 lines with:

```python
# Step 1: Build SDK tools (sync, no change)
sdk_tools = build_tools(functions) if functions else []

# Step 2: Router + KB assignment in parallel
router_result, (app_org_id, assigned_kb_ids) = await asyncio.gather(
    _run_router(config, user_text, session.id),
    _load_kb_assignment_context(db, session.app_id),
)

# Step 3: Scope rejection (strict mode only)
if not router_result.in_scope and config.scope_mode == "strict":
    rejection_text = (
        router_result.rejection_reason
        or "I can only help with questions related to this app."
    )
    seq = await get_next_sequence(db, session.id)
    db.add(Message(
        session_id=session.id,
        sequence_number=seq,
        role="assistant",
        content=rejection_text,
    ))
    await db.commit()
    await sender.send_turn_complete(rejection_text, None)
    return

# Step 4: KB pre-search + playbook load in parallel
should_prefetch = bool(
    router_result.needs_kb
    and router_result.kb_query
    and assigned_kb_ids
)
playbook_prompt, kb_context = await asyncio.gather(
    build_playbook_prompt(db, session.app_id),
    _prefetch_kb_context(
        session_id=session.id,
        app_org_id=app_org_id,
        assigned_kb_ids=assigned_kb_ids,
        query=router_result.kb_query or user_text,
    ) if should_prefetch else _noop_str(),
)

# Step 5: Build tools list
tools = list(sdk_tools)
if assigned_kb_ids:
    tools.append(_build_kb_search_tool())
tools_payload = tools or None
tool_round = 0
```

Inside the `while` loop, replace the existing 3-line system prompt assembly:

```python
# REMOVE these lines:
system_prompt = config.system_prompt
if playbook_prompt:
    system_prompt += playbook_prompt

# REPLACE WITH:
system_prompt = _assemble_system_prompt(
    dev_prompt=config.system_prompt,
    scope_mode=config.scope_mode,
    kb_context=kb_context,
    playbook_prompt=playbook_prompt,
)
```

**Everything else in the while loop is unchanged.**

---

### Step 6 — Dashboard UI

**File:** `dashboard/src/pages/AppConfig.tsx`

#### 6a. Update `Config` interface

```typescript
interface Config {
  system_prompt: string;
  llm_provider: string;
  llm_model: string;
  has_llm_api_key: boolean;
  llm_api_base: string | null;
  temperature: number;
  max_tokens: number;
  max_tool_rounds: number;
  session_ttl_minutes: number;
  max_context_messages: number;
  scope_mode: "open" | "strict";
}
```

#### 6b. Update the config-loading useEffect

Change the existing:
```typescript
api<Config>(`/v1/apps/${appId}/config`).then(setConfig);
```
To:
```typescript
api<Config>(`/v1/apps/${appId}/config`).then((data) =>
  setConfig({ ...data, scope_mode: data.scope_mode ?? "open" })
);
```

#### 6c. Update system_prompt Textarea in "Agent Behavior" FormSection

Change `placeholder` to:
```
Describe your app and what it does. For example:

"My app is a home automation controller that lets users manage smart lights, thermostats, and door locks. Users should be helped with device pairing, automation setup, scheduling, and troubleshooting connectivity issues."

This description is shown to the AI on every conversation turn to define what it should help with.
```

Add `hint` prop if the Textarea component supports it, otherwise add a `<p>` below:
```tsx
<p className="text-xs text-subtle mt-1.5">
  Describe your app clearly so the agent understands its purpose and scope. The more specific you are, the better the agent will perform.
</p>
```

#### 6d. Add scope_mode radio control below the Textarea (inside "Agent Behavior" FormSection)

```tsx
<div className="mt-4">
  <label className="text-xs font-medium text-subtle block mb-2">
    Scope Mode
  </label>
  <div className="flex gap-6">
    {(["open", "strict"] as const).map((mode) => (
      <label key={mode} className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="scope_mode"
          value={mode}
          checked={config.scope_mode === mode}
          onChange={() => setConfig({ ...config, scope_mode: mode })}
          className="accent-accent"
        />
        <span className="text-sm text-body capitalize">{mode}</span>
        <span className="text-xs text-subtle ml-1">
          {mode === "open"
            ? "— agent can answer any question"
            : "— only answers app-related questions"}
        </span>
      </label>
    ))}
  </div>
  <p className="text-xs text-subtle mt-1.5">
    In strict mode, the agent politely declines questions unrelated to your app.
  </p>
</div>
```

No changes to `handleSubmit` — the existing `{ ...config }` spread automatically includes `scope_mode`.

---

## Files Changed Summary

| File | Type | Change |
|------|------|--------|
| `alembic/versions/011_add_scope_mode_to_agent_configs.py` | **New** | Migration: add `scope_mode VARCHAR(20) DEFAULT 'open'` |
| `ios_app_agent/models/agent_config.py` | Edit | Add `scope_mode: Mapped[str]` after `max_context_messages` |
| `ios_app_agent/schemas/agent_config.py` | Edit | Add `from typing import Literal`; add `scope_mode` to `AgentConfigUpdate` + `AgentConfigOut` |
| `ios_app_agent/routers/config.py` | Edit | `_PROMPT_FIELDS` + `config_to_out()` |
| `ios_app_agent/services/orchestrator.py` | Edit | Add `dataclass` import; add constants, dataclass, 4 new functions; modify `run_agent_loop` |
| `dashboard/src/pages/AppConfig.tsx` | Edit | `Config` interface + scope_mode radio control + system_prompt guidance |

No new files other than the migration. No new dependencies. No changes to WS/SSE protocol, tool schemas, or iOS SDK contract.

---

## Backward Compatibility

- All existing apps have `scope_mode='open'` after migration (server default).
- In open mode: router still runs (benefits from KB pre-search) but never rejects a message.
- The `BASE_PROMPT` prepended to all system prompts changes agent behavior slightly — it now has explicit role guidance. This is intentional and additive.
- `kb_search` tool is still included in `tools_payload` when KBs are assigned. iOS SDK sees no change.
- `turn_complete` envelope is unchanged. Rejection messages are delivered as normal `turn_complete` events.

---

## Verification Steps

1. **Migration**: `uv run alembic upgrade head` → verify `scope_mode` column exists, all rows have `'open'`. Run `downgrade -1` then `upgrade head` to confirm reversibility.

2. **Backward compat**: existing app, no config changes → chat responds normally with no errors.

3. **Open mode, off-topic**: ask "what is the capital of France" → agent responds freely.

4. **Strict mode, off-topic**: set `scope_mode='strict'` via PUT `/v1/apps/{id}/config`, ask the same → `turn_complete` with polite rejection, message persisted as `role='assistant'`, session continues (not closed).

5. **Strict mode, in-scope**: ask a real support question → agent proceeds normally.

6. **BASE_PROMPT in assembled prompt**: temporarily `logger.debug("system_prompt=%s", system_prompt)` inside the while loop → verify sections appear in order.

7. **KB pre-search active**: assign a KB, ask a how-to question → verify `router_result.needs_kb=True` and `kb_context` contains `## Relevant Documentation` with actual content.

8. **KB pre-search skipped**: ask a conversational greeting → verify `router_result.needs_kb=False` and `kb_context=""`.

9. **kb_search fallback tool present**: verify `kb_search` still in `tools_payload` when KB is assigned, regardless of pre-search.

10. **Router failure resilience**: mock `call_llm` to raise → verify warning logged, agent proceeds, no 500 returned to user.

11. **Dashboard round-trip**: set strict → save → reload → radio shows "strict". Set open → save → verify.

12. **scope_mode in API response**: GET `/v1/apps/{id}/config` → response JSON includes `"scope_mode": "open"` (or "strict").
