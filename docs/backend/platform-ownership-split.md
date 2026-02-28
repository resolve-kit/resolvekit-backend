# Platform Ownership Split

## Goal

Separate runtime-agent responsibilities from dashboard-control-plane responsibilities while keeping the runtime in Python and moving dashboard stack delivery to Next.js.

## Service Responsibilities

## `www` (website, Next.js)

- Owns public marketing pages.
- No operational ownership of control-plane or runtime APIs.

## `dash` (dashboard UI, Next.js)

- Owns authenticated dashboard user interface.
- Calls control-plane APIs through `api` origin.
- Does not call `agent` directly in production topology.

## `api` (dashboard backend, Next.js route handlers)

- Owns external control-plane API boundary for dashboard.
- Exposes `/v1/*` routes to dashboard UI.
- Responsibilities:
  - direct control-plane implementation for `auth`, `apps`, and `api-keys`
  - explicit route-handler forwarding for remaining control-plane endpoints (no generic catch-all route)
  - attaching `X-Internal-Dashboard-Token`
  - converting login/signup token response into HttpOnly cookie (`dashboard_token`)
  - forwarding authenticated session context for bridged endpoint groups back to `agent`

## `agent` (runtime, FastAPI/Python)

- Owns all SDK runtime/chat orchestration.
- Public runtime routes:
  - `/v1/functions` (SDK routes)
  - `/v1/sessions` (SDK routes)
  - `/v1/sdk/*`
  - chat transports (`/ws`, SSE endpoints)
- Internal-only control-plane routes (when internal token configured):
  - `/v1/auth/*`
  - `/v1/organizations/*`
  - `/v1/apps/*` management
  - `/v1/knowledge-bases/*`
  - `/v1/apps/{app_id}/functions` (dashboard)
  - `/v1/apps/{app_id}/sessions` (dashboard)
  - `/v1/apps/{app_id}/playbooks` and related config/audit/api-key routes

## `knowledge_bases` (FastAPI/Python)

- Owns KB ingestion/search internals.
- Internal API under `/internal/*` only.

## Trust Boundaries

- Dashboard browser traffic trusts `api` only.
- `api` trusts `agent` via:
  - private network access
  - shared secret header (`X-Internal-Dashboard-Token`)
- `agent` trusts `knowledge_bases` via JWT-based service-to-service contract.
- SDK clients trust `agent` directly with app API keys for runtime endpoints only.

## Data Ownership

- `db` (primary):
  - organizations, developers, apps, config, api keys, sessions/messages, functions, playbooks, audit events
- `kb-db`:
  - KB sources/documents/chunks/jobs/embedding profiles

## Operational Notes

- `IAA_DASHBOARD_INTERNAL_TOKEN` controls enforcement at `agent`.
  - unset: compatibility mode (dashboard routes still reachable directly)
  - set: dashboard routes require internal token header
- `DASHBOARD_INTERNAL_TOKEN` on Next dashboard backend must match `IAA_DASHBOARD_INTERNAL_TOKEN`.
- `AGENT_API_BASE_URL` configures where `api` forwards control-plane requests.
- Catch-all forwarding route `src/app/v1/[...path]/route.ts` has been removed in favor of explicit endpoint files.
