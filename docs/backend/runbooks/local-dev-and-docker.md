# Local Dev + Docker Runbook

## Prerequisites

- Docker Desktop
- `uv` for Python local commands
- Node/npm for dashboard and website local commands

## Docker-first setup

1. Configure `.env` (copy from `.env.example` if needed).
2. Build local web SDK package used by dashboard/api containers:
   - `npm --prefix ../resolvekit-web-sdk run build`
   - Optional if SDK repo is elsewhere: set `RESOLVEKIT_WEB_SDK_PATH=/absolute/path/to/resolvekit-web-sdk`
3. Start stack:
   - `docker compose up --build -d`
4. Check services:
   - `docker compose ps`
   - `curl -s http://localhost:8000/health`
   - `docker compose logs --tail=20 kb-service`
5. Tail logs:
   - `docker compose logs -f backend`
   - `docker compose logs -f kb-service`
   - `docker compose logs -f dashboard`
   - `docker compose logs -f api`
   - `docker compose logs -f website`

## Production compose setup

1. Configure production env values (secrets + public URLs).
2. Build and run:
   - `docker compose -f docker-compose.prod.yml --env-file .env up -d --build`
3. Check services:
   - `docker compose -f docker-compose.prod.yml ps`
4. Tail logs:
   - `docker compose -f docker-compose.prod.yml logs -f backend`
   - `docker compose -f docker-compose.prod.yml logs -f api`
   - `docker compose -f docker-compose.prod.yml logs -f dashboard`
   - `docker compose -f docker-compose.prod.yml logs -f website`

## Python local backend setup

1. Install deps:
   - `uv sync --extra dev`
2. Run migrations:
   - `uv run alembic upgrade head`
3. Start API:
   - `uv run python main.py`

## Dashboard local setup

1. Install:
   - `npm --prefix dashboard install`
2. Run dev server:
   - `npm --prefix dashboard run dev`
3. Production build check:
   - `npm --prefix dashboard run build`
4. If using separate local API origin:
   - set `NEXT_PUBLIC_API_BASE_URL` to `http://localhost:3002`
   - run a second dashboard container/service as `api` from compose

## Website local setup

1. Install:
   - `npm --prefix website install`
2. Run dev server:
   - `npm --prefix website run dev`
3. Production build check:
   - `npm --prefix website run build`

## Validation commands

- Backend tests:
  - `uv run python -m pytest`
- SDK integration contract checks:
  - `uv run python scripts/check_openapi_sync.py`
- OpenAPI regeneration:
  - `uv run python scripts/export_openapi.py`

## Common issues

- `chat_unavailable`:
  - Check app integration status and LLM profile assignment.
- `invalid_llm_profile` or `no_llm_profile`:
  - Confirm app config references an org profile that exists.
- KB request failures:
  - Verify `IAA_KNOWLEDGE_BASES_*` and `KBS_SERVICE_JWT_*` values match.
- Dashboard cannot reach API:
  - Verify `NEXT_PUBLIC_API_BASE_URL` points to the dashboard API origin (for local, `http://localhost:3002`).
  - Verify dashboard `api` service has `DATABASE_URL`, `IAA_JWT_*`, `IAA_ENCRYPTION_KEY`, and `IAA_KNOWLEDGE_BASES_*` configured.
- WS auth failures:
  - Ensure ws-ticket flow is used and token not expired.
