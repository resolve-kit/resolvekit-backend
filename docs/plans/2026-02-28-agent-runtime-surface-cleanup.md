# 2026-02-28 Agent Runtime Surface Cleanup

## Context

After moving dashboard control-plane APIs to Next.js (`dashboard` service), the Python `agent` service still exposed legacy dashboard/control-plane routes.

## Goals

1. Rename local runtime DB defaults from `ios_app_agent` to `agent`.
2. Remove duplicated dashboard/control-plane API exposure from `agent`.
3. Keep SDK/chat runtime routes in `agent` intact.
4. Update docs and tests to reflect final ownership split.

## Plan

1. Update environment defaults and local `.env` values.
2. Remove control-plane router mounts from `agent/main.py`.
3. Remove obsolete internal dashboard token middleware/settings/tests.
4. Update ownership and router docs.
5. Regenerate OpenAPI snapshots and run focused verification tests.
6. Remove dead Python control-plane-only schemas/services and stale docs that still described pre-split behavior.

## Progress

- [x] Step 1: Environment defaults updated (`.env`, `.env.example`, `docker-compose.yml`).
- [x] Step 2: `agent/main.py` now mounts runtime-only routers (`functions.sdk_router`, `sessions.sdk_router`, chat + sdk).
- [x] Step 3: Removed internal dashboard token middleware and related config/tests.
- [x] Step 4: Updated docs under `docs/backend/*` to match runtime/control-plane ownership split.
- [x] Step 5: Regenerate OpenAPI + run verification tests.
- [x] Step 6: Removed legacy Python control-plane router modules/tests no longer used after Next migration.
- [x] Step 7: Removed dead Python control-plane-only schemas/services + stale control-plane docs:
  - deleted unused `agent/schemas/*` modules for developer/app/org/playbook/audit/provider/KB control-plane payloads
  - deleted unused `agent/services/*` modules for control-plane onboarding/provider/audit authorization logic
  - removed tests that only exercised deleted control-plane-only Python schemas
  - refreshed `CLAUDE.md`, `docs/backend/ios-app-agent-capabilities.md`, and `docs/backend/error-contracts.md`
- [x] Step 8: Completed dashboard shell routing cleanup for Next 16:
  - renamed `dashboard/src/middleware.ts` to `dashboard/src/proxy.ts`
  - updated export from `middleware` to `proxy`
  - verified `npm --prefix dashboard run build` succeeds without middleware deprecation warning
- [x] Step 9: Fixed runtime decrypt failure caused by unpadded Fernet tokens from dashboard:
  - root cause: dashboard Fernet encoder stripped `=` base64 padding, which Python `cryptography.Fernet` rejects
  - strict fix: dashboard now preserves URL-safe base64 padding in `dashboard/src/lib/server/fernet.ts`
  - no runtime backward-compat layer added to `agent`
  - repaired existing local DB encrypted token rows so current runtime calls succeed after rebuild
- [x] Step 10: Fixed dashboard session preview 500 error:
  - root cause: Prisma `Message.sequenceNumber` field missing DB mapping to `sequence_number`
  - fix: `dashboard/prisma/schema.prisma` updated with `@map("sequence_number")`
  - added guard test `tests/test_dashboard_prisma_schema_contract.py`
  - verified `GET /v1/apps/{appId}/sessions/{sessionId}/messages` returns `200` with payload
- [x] Step 11: Strict mode greeting behavior tuning:
  - router prompt updated so greetings and brief social niceties are classified as in-scope
  - strict mode remains enforced for unrelated substantive queries
  - added prompt contract test `tests/test_orchestrator_router_smalltalk_prompt_contract.py`
  - verified live runtime response for `hi` returns a natural greeting instead of scope rejection
- [x] Step 12: Strict mode rejection clarity for out-of-scope shopping/product-finding asks:
  - strict gate now uses `router_result.rejection_reason` when provided, with fallback to generic strict text
  - router prompt now instructs specific user-facing reason for "find/choose products for me" requests
  - added regression coverage for router-reason passthrough + generic fallback behavior
- [x] Step 13: Ensure support-contact questions trigger assigned-KB search:
  - root cause: KB prefetch depended solely on router `needs_kb`; classifier misses skipped KB lookup
  - fix: add deterministic support-contact intent heuristic to force KB prefetch when assigned KBs exist
  - router prompt now explicitly marks support contact detail questions as `needs_kb=true`
  - added regression test for "what is the support email?" flow when router returns `needs_kb=false`
- [x] Step 14: iOS runtime resume/reconnect stabilization (minimize -> reopen chat):
  - root cause: websocket stream lifecycle allowed stale connection failures to surface on the current stream, and runtime moved to non-recoverable failed/reconnecting states without transport fallback
  - fix in iOS SDK repos (`playbook-ios-sdk`, `PlaybookTestApp/sdk`):
    - isolate websocket streams per connect and ignore stale task errors
    - on websocket disconnect/failure, degrade to SSE fallback state instead of hard failure
    - add runtime tests for disconnect + connection-abort fallback behavior
- [x] Step 15: Strict-mode URL follow-up context handling:
  - root cause: URL-only user follow-ups (after assistant asks for URL) lacked action tokens, so strict scope gate rejected before normal handling
  - fix: allow strict-scope override for URL-only follow-ups when:
    - recent assistant context explicitly requested a URL/link
    - active app functions accept URL input (`url`, `*_url`, etc.)
  - added regression test for flow: assistant asks for URL -> user pastes raw URL -> turn proceeds in-scope
- [x] Step 16: Strict-mode general conversational context carry-over:
  - root cause: router classification previously received only current user text, making short/ambiguous follow-ups brittle in strict mode
  - fix:
    - router prompt now includes recent conversation context and active product actions
    - strict override now supports brief contextual follow-ups (for example confirmations and short parameter replies) when they continue recent assistant prompts
  - added regression tests for:
    - brief contextual follow-up continuation (`yes, every 10 minutes`)
    - router prompt payload includes recent conversation + function capabilities

## Runtime Ownership (Final)

- `dashboard` Next.js (`api` origin) owns dashboard control-plane `/v1/*` routes.
- `agent` FastAPI owns SDK/runtime routes only:
  - `/v1/functions/*` (SDK)
  - `/v1/sessions/*` (SDK)
  - `/v1/sdk/*`
  - chat transports (`WS /v1/sessions/{session_id}/ws`, SSE/message routes)
- Legacy control-plane router modules deleted from `agent/routers`:
  - `auth.py`, `organizations.py`, `apps.py`, `api_keys.py`, `config.py`, `audit.py`, `knowledge_bases.py`, `playbooks.py`
- Dashboard-only subrouters removed from runtime router files:
  - `functions.dashboard_router`
  - `sessions.dashboard_router`

## Verification

- OpenAPI regenerated via `uv run python scripts/export_openapi.py`.
- Focused tests passed:
  - `tests/test_subdomain_env_contract.py`
  - `tests/test_runtime_entrypoints_after_rename.py`
  - `tests/test_dashboard_next_control_plane_contract.py`
  - `tests/test_openapi_snapshot_names.py`
- Verified `docs/generated/openapi/agent.openapi.json` includes runtime routes and no longer contains dashboard control-plane paths.
