# Agent/Dashboard Split + Unified Next Dashboard Plan (2026-02-28)

## Goal

Separate control-plane traffic from runtime traffic:

- keep runtime `agent` in Python/FastAPI
- move dashboard stack to Next.js (`dash` UI + `api` route handlers)
- preserve current dashboard API surface under `/v1/*`

## Target Topology

- `www`: website Next.js app
- `dash`: dashboard UI (Next.js app)
- `api`: dashboard backend (`/v1` Next route handlers)
- `agent`: Python runtime + internal control-plane endpoints
- `knowledge_bases`: internal KB ingestion/search service

## Key Decisions

1. Runtime SDK contracts remain unchanged on `agent`.
2. Dashboard control-plane routes are internally gated in `agent` with `X-Internal-Dashboard-Token`.
3. Next route handlers own dashboard control-plane behavior directly and own browser-facing auth/session boundary.
4. Dashboard and API remain one Next codebase, deployable behind separate origins.

## Implementation Tasks

### Task 1: Branch and baseline

- Create feature branch `feat/agent-dashboard-next-split`.
- Keep `main` clean and pushed before migration work.

### Task 2: Convert dashboard package to Next.js

- Replace Vite scripts/tooling with Next scripts/tooling.
- Add Next app router entrypoints (`src/app/layout.tsx`, `src/app/page.tsx`).
- Reuse existing dashboard React app by mounting it as a client component.

### Task 3: Add dashboard backend in Next route handlers

- Add `/v1/*` route coverage in Next route handlers.
- Set HttpOnly cookie on successful login/signup responses.
- Add direct Next-owned control-plane handlers for:
  - `auth` (`login`, `signup`, `me`, `password-guidance`)
  - `apps` (`list`, `create`, `get`, `patch`, `delete`)
  - `api-keys`, `functions`, `playbooks`, `sessions`, `audit`, `config`, `chat theme/localizations`
  - `organizations` (`me`, onboarding, members, invitations, LLM and embedding profile endpoints)
  - `knowledge-bases` and app knowledge-base assignment endpoints

### Task 4: Enforce internal control-plane boundary in Python agent

- Add `agent/middleware/dashboard_internal.py`.
- Add `IAA_DASHBOARD_INTERNAL_TOKEN` setting.
- Apply route dependencies in `agent/main.py` to control-plane routers.

### Task 5: Infrastructure and config wiring

- Update `dashboard/Dockerfile` for Next runtime.
- Add/adjust `dashboard` + `api` services in `docker-compose.yml`.
- Update `.env.example` to use `NEXT_PUBLIC_API_BASE_URL` and internal token settings.

### Task 6: Documentation and ownership map

- Update service overview + config/runbook docs.
- Add platform ownership document:
  - `docs/backend/platform-ownership-split.md`
- Keep docs index and README aligned.

### Task 7: Verification gates

- Python contract tests for env/internal-boundary changes.
- Dashboard Next build verification.
- Existing runtime route tests that should remain unchanged.

## Progress Tracking

### Phase A: Split foundation

- [x] Next dashboard migration (`dash` + `api` codebase).
- [x] Internal token boundary enforcement in `agent`.
- [x] Direct Next handlers for `auth`, `apps`, `api-keys`.
- [x] Initial ownership/config/docs updates.

### Phase B: Full `/v1` route map in Next (no catch-all)

- [x] Add temporary shared route-forwarding helper (`src/lib/server/agent-proxy.ts`) during migration.
- [x] Replace generic catch-all with explicit route handlers for all dashboard-used `/v1` endpoints:
  - apps/functions/playbooks/sessions/audit/chat-theme/chat-localizations/config
  - organizations/me/onboarding/members/invitations/llm/embedding endpoints
  - knowledge-bases and app knowledge-base assignment endpoints
- [x] Remove `src/app/v1/[...path]/route.ts`.
- [x] Add contract test coverage for explicit route presence and catch-all removal.

### Phase C: Native control-plane rewrite

- [x] Replace route-forwarding handlers with native Next implementations across all dashboard `/v1` routes.
- [x] Add native shared services for:
  - provider catalog/model lookup and connection tests
  - Fernet-compatible key encryption/decryption
  - KB internal service JWT client integration
  - onboarding state computation and localization/theme normalization
- [x] Remove migration-only forwarding helper (`src/lib/server/agent-proxy.ts`).

### Phase D: Dashboard OpenAPI artifact

- [x] Add dashboard OpenAPI exporter (`scripts/export_dashboard_openapi.py`).
- [x] Extend `scripts/export_openapi.py` and `scripts/check_openapi_sync.py` to include `dashboard.openapi.json`.
- [x] Commit generated artifact at `docs/generated/openapi/dashboard.openapi.json`.

### Phase E: Verification

- [x] `uv run python -m pytest tests/test_dashboard_next_control_plane_contract.py -v`
- [x] `uv run python -m pytest tests/test_dashboard_internal_boundary.py tests/test_dashboard_api_base_url_contract.py tests/test_subdomain_env_contract.py tests/test_dashboard_onboarding_contract.py -v`
- [x] `npm --prefix dashboard run build`
- [x] `python scripts/check_openapi_sync.py`

## Validation Checklist

- [x] `uv run python -m pytest tests/test_dashboard_internal_boundary.py -v`
- [x] `uv run python -m pytest tests/test_dashboard_api_base_url_contract.py tests/test_subdomain_env_contract.py -v`
- [x] `npm --prefix dashboard run build`
- [x] confirm `agent` runtime routes continue to load/start

## Remaining Follow-up Work

1. Expand generated dashboard OpenAPI with detailed request/response schemas beyond path/method inventory.
2. Add endpoint-level runtime tests for native provider and KB flows (success + error mappings).
3. Continue reducing duplicate domain logic shared between Python and Next control-plane implementations.
