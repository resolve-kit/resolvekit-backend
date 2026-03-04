# Orchestrator Flow

The runtime orchestrator lives in [`agent/services/orchestrator.py`](../../agent/services/orchestrator.py).

## Core Entry

- `run_agent_loop(...)`

Inputs:

- `db` session
- `ChatSession`
- `AgentConfig`
- eligible `RegisteredFunction` list
- user text
- transport-specific `MessageSender`

## Turn Lifecycle

1. Persist user message with sequence number.
2. Load context needed for enrichment:
   - KB assignments (`_load_kb_assignment_context`)
   - router result (`_run_router`)
   - playbook prompt (`build_playbook_prompt`)
3. Scope handling:
   - `scope_mode=open`: continue regardless of router scope.
   - `scope_mode=strict` + out-of-scope: send rejection and short-circuit turn.
4. KB prefetch:
   - If router indicates KB needed, prefetch docs via internal KB client.
   - Render docs in prompt block (`## Relevant Documentation`).
5. Compose enriched system prompt:
   - non-configurable `BASE_PROMPT`
   - app-specific `system_prompt`
   - scope guidance
   - platform/client context
   - custom per-session `llm_context`
   - KB prefetch block
   - playbook block
6. Main LLM loop:
   - Build tools (`SDK functions` + optional `kb_search` fallback tool).
   - Call model via `call_llm`.
   - If tool calls exist:
     - internal KB tool call handled server-side.
     - SDK function call emitted to client and await tool result.
     - append tool result messages and continue until completion/max rounds.
   - If assistant text available:
     - stream deltas when supported.
     - persist final assistant message.
     - emit `turn_complete`.
7. Update session activity metadata.

## Context Sources Used Each Turn

- App config:
  - `system_prompt`
  - `scope_mode`
  - model/runtime settings
- Session context:
  - `client_context` (platform, app version, SDK version, etc.)
  - `llm_context` (custom structured fields from SDK)
  - eligibility fields (`available_function_names`)
- Knowledge context:
  - assigned KB IDs for app
  - prefetch search results
- ResolveKit context:
  - active playbooks and ordered function steps

## Tool Dispatch Paths

- Internal tool:
  - `kb_search` (executes inside backend)
- External tools:
  - SDK-registered functions (executed by client app through transport)

Transport implementations:

- WS sender: [`agent/routers/chat_ws.py`](../../agent/routers/chat_ws.py)
- SSE sender: [`agent/routers/chat_http.py`](../../agent/routers/chat_http.py)

## Failure and Fallback Behavior

- Router failure defaults to fail-open (`in_scope=true`, `needs_kb=true`).
- KB prefetch failure does not abort turn; run continues with degraded context.
- Tool timeout or runtime errors are reported and folded into follow-up model reasoning.
- Chat availability/provider outages map to `chat_unavailable` contract.

## Related Docs

- [Error Contracts](error-contracts.md)
- [SDK Integration Protocol](../../SDK_INTEGRATION.md)
