# Environment Reference

Settings are loaded via pydantic settings models:

- `agent`: [`agent/config.py`](../../agent/config.py), prefix `RK_`
- `knowledge_bases`: [`knowledge_bases/config.py`](../../knowledge_bases/config.py), prefix `KBS_`

## `RK_*` variables

## Core runtime

- `RK_DATABASE_URL`
  - Async SQLAlchemy DSN for primary backend DB.
- `RK_DEBUG`
  - Enables debug mode behavior.
- `RK_CORS_ORIGINS`
  - Allowed frontend origins.

## Auth and secrets

- `RK_JWT_SECRET`
- `RK_JWT_ALGORITHM` (default `HS256`)
- `RK_JWT_EXPIRE_MINUTES`
- `RK_ENCRYPTION_KEY`
  - Fernet key used for encrypting sensitive data at rest.

## Chat transport and compatibility

- `RK_ALLOW_LEGACY_WS_API_KEY`
  - Enables legacy API-key query-param WS auth.
- `RK_MINIMUM_SDK_VERSION`
- `RK_SUPPORTED_SDK_MAJOR_VERSIONS`
- `RK_CHAT_CAPABILITY_SECRET`
- `RK_CHAT_CAPABILITY_TTL_SECONDS`
- `RK_REDIS_URL`
  - Redis DSN for cross-instance WS continuity (owner lease, outbox replay, tool-result handoff).
- `RK_INSTANCE_ID`
  - Stable process identifier for Redis owner leasing (defaults to hostname).
- `RK_WS_OWNER_TTL_SECONDS`
  - Owner lease TTL for active WS session shards.
- `RK_WS_OUTBOX_TTL_SECONDS`
  - TTL for buffered WS outbound frames in Redis.
- `RK_WS_TOOL_RESULT_TTL_SECONDS`
  - TTL for bridged tool results in Redis.

## KB bridge

- `RK_KNOWLEDGE_BASES_BASE_URL`
- `RK_KNOWLEDGE_BASES_AUDIENCE`
- `RK_KNOWLEDGE_BASES_SIGNING_KEY`
- `RK_KNOWLEDGE_BASES_JWT_ALGORITHM`
- `RK_KNOWLEDGE_BASES_TIMEOUT_SECONDS`
- `RK_KNOWLEDGE_BASES_CONNECT_TIMEOUT_SECONDS`

## Frontend integration

- `NEXT_PUBLIC_API_BASE_URL`
  - Dashboard API base URL used from `dash` UI.
  - In split-host production this is typically `https://api.<domain>`.
  - In the single-host quickstart this can be the dashboard origin itself.
- `NEXT_PUBLIC_IOS_SDK_REPO_URL`
  - Optional public link used by dashboard onboarding CTAs for iOS SDK source/docs.
- `DATABASE_URL`
  - Dashboard Next route handler DB connection string (Prisma).
- `RESOLVEKIT_SERVER_AGENT_BASE_URL`
  - Optional server-only agent URL used by dashboard server-side runtime lookups.
  - Must use HTTPS unless it targets `localhost`.
  - Useful in reverse-proxy or internal-network deployments where the dashboard server should use a server-only URL that differs from the browser-facing control-plane URL.
  - In dockerized deployments this can point directly at `http://backend:8000`.
- `RK_JWT_SECRET`
- `RK_JWT_ALGORITHM`
- `RK_JWT_EXPIRE_MINUTES`
  - Dashboard browser-session token settings.
- `RK_ENCRYPTION_KEY`
  - Used by dashboard API for encrypting/decrypting provider profile API keys (Fernet-compatible).
  - Production must provide an explicit valid Fernet key.
  - During local Next.js development, the dashboard can derive a stable fallback from `RK_JWT_SECRET` when this value is missing or invalid.
- `RK_KNOWLEDGE_BASES_BASE_URL`
- `RK_KNOWLEDGE_BASES_AUDIENCE`
- `RK_KNOWLEDGE_BASES_SIGNING_KEY`
- `RK_KNOWLEDGE_BASES_JWT_ALGORITHM`
  - Used by dashboard API to call KB service internal endpoints directly.

## `KBS_*` variables

## Core runtime

- `KBS_DATABASE_URL`
- `KBS_DEBUG`
- `KBS_WORKER_ENABLED`
- `KBS_WORKER_POLL_SECONDS`

## Auth and encryption

- `KBS_SERVICE_JWT_SIGNING_KEY`
- `KBS_SERVICE_JWT_ALGORITHM`
- `KBS_SERVICE_JWT_AUDIENCE`
- `KBS_ENCRYPTION_KEY`

## Crawling behavior

- `KBS_CRAWL_TIMEOUT_SECONDS`
- `KBS_CRAWL_MAX_PAGES`
- `KBS_CRAWL_MAX_DEPTH`
- `KBS_CRAWL_USER_AGENT`
- `KBS_USE_CRAWL4AI`
- `KBS_CRAWL4AI_HEADLESS`
- `KBS_CRAWL4AI_VERBOSE`
- `KBS_CRAWL4AI_BASE_DIRECTORY`

## Upload conversion behavior

- `KBS_UPLOAD_MAX_FILE_BYTES`
- `KBS_UPLOAD_ALLOWED_EXTENSIONS`
- `KBS_UPLOAD_OCR_ENABLED`

## Defaults and examples

- See `.env.example` and `docker-compose.yml` for local defaults and service wiring.
- `.env.local-deploy.example` demonstrates the single-host quickstart (`/agent` path prefix).
- `.env.prod.example` demonstrates the recommended split-host production topology.

## Operational Notes

- Production must override insecure defaults for:
  - `RK_JWT_SECRET`
  - `RK_ENCRYPTION_KEY`
  - `KBS_SERVICE_JWT_SIGNING_KEY`
  - `KBS_ENCRYPTION_KEY`
- `agent` startup validates critical secrets when debug mode is off.
