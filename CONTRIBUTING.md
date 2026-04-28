# Contributing

ResolveKit Backend is released under `AGPL-3.0-only`. Contributions accepted into this repository are expected to be licensed under the same terms.

## Development Setup

Use the local Docker stack for the full system:

```bash
docker compose up --build -d
```

For Python-only backend work:

```bash
uv sync --extra dev
uv run alembic upgrade head
uv run python main.py
```

For dashboard work:

```bash
cd dashboard
npm ci
npm test
npm run build
```

## Pull Requests

Before opening a PR:

- keep the change focused and explain the user-facing impact
- add or update tests for behavior changes
- update docs when configuration, deployment, or API behavior changes
- do not commit secrets, local databases, generated runtime state, or private planning notes
- run the relevant tests locally

Non-trivial external contributions may require a contributor agreement before merge so the project can maintain both the open-source edition and separate commercial offerings.

## Coding Standards

- Validate input at service and API boundaries.
- Prefer typed public interfaces.
- Keep deployment examples domain-neutral and self-host friendly.
- Keep enterprise-only integrations out of the OSS repository.

