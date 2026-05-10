# resolvekit-backend

ResolveKit Backend — multi-service runtime for agent orchestration, tool routing, knowledge retrieval, and operational control.

## Working Contract

- Humans define API surface, security requirements, and quality bars.
- Agents implement code, tests, migrations, and CI changes.
- API changes must include OpenAPI spec updates and docs updates.
- Security-related changes require explicit human review.

## Project Overview

Primary services:

- `agent` (FastAPI): SDK session lifecycle, event stream, tool result ingestion, function registration.
- `knowledge_bases` (FastAPI): KB creation, source ingestion, embedding/search, usage summaries.
- `dashboard` (Next.js): dashboard UI + `/v1/*` control-plane API route handlers.
- Data plane: PostgreSQL + Redis.

**Tech Stack**: Python 3.13, FastAPI, SQLAlchemy, Next.js, Prisma
**License**: AGPL-3.0-only

## Agent Skills

ResolveKit integration skills are available at https://github.com/resolve-kit/resolvekit-skills

**Quick install:**
```bash
curl -sL https://raw.githubusercontent.com/resolve-kit/resolvekit-skills/master/install.sh | bash -s .
```

**Platform-specific skills:**

- `resolvekit-backend-setup` — How to deploy and configure the ResolveKit backend. Covers Docker Compose setup, environment configuration, production deployment, knowledge base setup, and control-plane API integration.
- `resolvekit-agent-instructions` — How AI agents should approach ResolveKit integration. Covers project detection, function design patterns, integration order, and verification.

When a user asks to set up or deploy the ResolveKit backend, load `resolvekit-backend-setup` and follow its steps.

## First Read

1. `docker-compose.yml` for service topology.
2. `.env.example` for required configuration.
3. `agent/`, `knowledge_bases/`, `dashboard/` for service organization.
