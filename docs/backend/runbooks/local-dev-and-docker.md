# Local Dev + Docker Runbook

## Prerequisites

- Docker Desktop
- `uv` for Python local commands
- Node/npm for dashboard local commands

## Docker-first setup

1. Configure `.env` (copy from `.env.example` if needed).
2. Start stack:
   - `docker compose up --build -d`
3. Check services:
   - `docker compose ps`
   - `curl -s http://localhost:8000/health`
   - `docker compose logs --tail=20 kb-service`
4. Tail logs:
   - `docker compose logs -f backend`
   - `docker compose logs -f kb-service`
   - `docker compose logs -f dashboard`

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
  - Verify `IAA_KB_SERVICE_*` and `KBS_SERVICE_JWT_*` values match.
- WS auth failures:
  - Ensure ws-ticket flow is used and token not expired.
