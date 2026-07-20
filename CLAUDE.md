# ResolveKit Backend

This repository is split into runtime services (Python) and control-plane services (Next.js).

## Service Split

- `agent` (FastAPI, Python)
  - Runtime-only SDK/chat API.
  - No dashboard control-plane routes.
- `dashboard` (Next.js)
  - `dash`: dashboard UI.
  - `api`: dashboard `/v1/*` route handlers (control plane).
- `knowledge_bases` (FastAPI, Python)
  - Internal KB ingestion/search service (`/internal/*`).

Detailed ownership map: `docs/backend/platform-ownership-split.md`.

## Runtime Endpoints (`agent`)

- `PUT /v1/functions/bulk`
- `GET /v1/functions`
- `GET /v1/functions/eligible`
- `POST /v1/sessions`
- `GET /v1/sessions/{session_id}/localization`
- `GET /v1/sessions/{session_id}/messages`
- `POST /v1/sessions/{session_id}/ws-ticket`
- `WS /v1/sessions/{session_id}/ws`
- `POST /v1/sessions/{session_id}/messages` (SSE)
- `POST /v1/sessions/{session_id}/tool-results`
- `GET /v1/sdk/compat`
- `GET /v1/sdk/chat-theme`

Exact contracts: `docs/generated/openapi/agent.openapi.json`.

## Control-Plane Endpoints (`dashboard` `api`)

Dashboard auth/apps/config/organizations/knowledge-bases/playbooks/functions/audit endpoints are implemented in:

- `dashboard/src/app/v1/**/route.ts`

Exact contracts: `docs/generated/openapi/dashboard.openapi.json`.

## Local Run

```bash
cp .env.example .env
docker compose up --build -d
```

- Dashboard UI: `http://localhost:3000`
- Dashboard API origin: `http://localhost:3002`
- Agent runtime: `http://localhost:8000`
- Agent health: `GET http://localhost:8000/health`

## CI/CD & Deployment

Pipeline: `.github/workflows/publish-images.yml` (backend, kb-service, dashboard images).

- **CI** (`.github/workflows/ci.yml`): runs on every push to `main` and PR — lint/tests only, no deploy.
- **Build**: on push to `main`, on tag `v*`, or manual `workflow_dispatch`, builds and pushes all 3 images to GHCR (`ghcr.io/<owner>/resolvekit-{backend,kb-service,dashboard}`), tagged `latest` (default branch), `sha-<short-sha>`, and ref tags.
- **Deploy to staging**: automatic after every successful build on `main` push. Can also be triggered manually via `workflow_dispatch` with `deploy_target: staging`. SSHes into the staging host and runs `docker compose -f docker-compose.local-deploy.yml up -d --no-build` for `backend kb-service api dashboard caddy`.
- **Deploy to prod**: manual only — never runs on plain pushes. Trigger via:
  ```bash
  gh workflow run publish-images.yml -f deploy_target=prod
  # optionally pin an image: -f image_tag=sha-<short-sha>  (defaults to sha-<current-commit>)
  ```
  SSHes into the prod host and runs `docker compose -f docker-compose.prod.yml up -d --no-build` for `backend kb-service api dashboard`.
- Both deploy jobs fail loudly if any target service isn't `running` after the compose command.

## Key Commands

- `uv run alembic upgrade head`
- `uv run python main.py`
- `uv run python scripts/export_openapi.py`
- `uv run python scripts/check_openapi_sync.py`
- `npm --prefix dashboard run build`
- `uv run python -m pytest`

## Canonical Docs

- `README.md`
- `docs/INDEX.md`
- `docs/backend/services-overview.md`
- `docs/backend/router-map.md`
- `docs/backend/config-env-reference.md`
