# resolvekit-backend

This file is the **table of contents** for coding agents. Keep it short, stable, and current.

## Working Contract

- Humans define intent and constraints.
- Agents implement code, tests, docs, and CI changes.
- Repository-local docs are the system of record.
- If docs and code diverge, fix docs in the same change.

## First Read

1. `README.md` for product and self-host setup.
2. `docs/INDEX.md` for architecture, API, and operations maps.
3. `docs/agent-first/README.md` for agent operating principles.

## Commands

```bash
uv sync --extra dev
uv run python -m pytest -q
npm --prefix dashboard ci
npm --prefix dashboard test
```

## Source of Truth Layout

- `agent/` backend runtime and API handlers.
- `dashboard/` Next.js admin and API surfaces.
- `knowledge_bases/` KB service runtime.
- `docs/INDEX.md` documentation index.
- `docs/exec-plans/` active/completed execution plans and tech debt.
- `docs/generated/openapi/` generated API snapshots.

## Guardrails

- Never commit secrets or private `.env` values.
- Keep API contract and behavior docs synchronized.
- Prefer incremental PRs with passing checks over large refactors.
- Run `bash scripts/check_agent_docs.sh` before opening PRs that touch docs/architecture.
