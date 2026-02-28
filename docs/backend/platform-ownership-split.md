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
  - direct control-plane implementation for full dashboard `/v1/*` surface
  - direct DB access via Prisma for org/app/config/session/playbook/function/audit flows
  - direct KB service integration for KB and embedding profile flows
  - converting login/signup token response into HttpOnly cookie (`dashboard_token`)
  - browser auth/session boundary for dashboard clients

## `agent` (runtime, FastAPI/Python)

- Owns all SDK runtime/chat orchestration.
- Public runtime routes:
  - `/v1/functions` (SDK routes)
  - `/v1/sessions` (SDK routes)
  - `/v1/sdk/*`
  - chat transports (`/ws`, SSE endpoints)

## `knowledge_bases` (FastAPI/Python)

- Owns KB ingestion/search internals.
- Internal API under `/internal/*` only.

## Trust Boundaries

- Dashboard browser traffic trusts `api` only.
- `api` trusts KB service via signed service JWT and internal network.
- `agent` trusts `knowledge_bases` via JWT-based service-to-service contract.
- SDK clients trust `agent` directly with app API keys for runtime endpoints only.

## Data Ownership

- `db` (primary):
  - organizations, developers, apps, config, api keys, sessions/messages, functions, playbooks, audit events
- `kb-db`:
  - KB sources/documents/chunks/jobs/embedding profiles

## Operational Notes

- Dashboard Next API owns dashboard control-plane routes directly and no longer forwards through `agent`.
- Catch-all forwarding route `src/app/v1/[...path]/route.ts` has been removed.
