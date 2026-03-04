# Environment Reference

Settings are loaded via pydantic settings models:

- `agent`: [`agent/config.py`](../../agent/config.py), prefix `IAA_`
- `knowledge_bases`: [`knowledge_bases/config.py`](../../knowledge_bases/config.py), prefix `KBS_`

## `IAA_*` variables

## Core runtime

- `IAA_DATABASE_URL`
  - Async SQLAlchemy DSN for primary backend DB.
- `IAA_DEBUG`
  - Enables debug mode behavior.
- `IAA_CORS_ORIGINS`
  - Allowed frontend origins.

## Auth and secrets

- `IAA_JWT_SECRET`
- `IAA_JWT_ALGORITHM` (default `HS256`)
- `IAA_JWT_EXPIRE_MINUTES`
- `IAA_ENCRYPTION_KEY`
  - Fernet key used for encrypting sensitive data at rest.

## Chat transport and compatibility

- `IAA_ALLOW_LEGACY_WS_API_KEY`
  - Enables legacy API-key query-param WS auth.
- `IAA_MINIMUM_SDK_VERSION`
- `IAA_SUPPORTED_SDK_MAJOR_VERSIONS`
- `IAA_CHAT_CAPABILITY_SECRET`
- `IAA_CHAT_CAPABILITY_TTL_SECONDS`

## KB bridge

- `IAA_KNOWLEDGE_BASES_BASE_URL`
- `IAA_KNOWLEDGE_BASES_AUDIENCE`
- `IAA_KNOWLEDGE_BASES_SIGNING_KEY`
- `IAA_KNOWLEDGE_BASES_JWT_ALGORITHM`
- `IAA_KNOWLEDGE_BASES_TIMEOUT_SECONDS`
- `IAA_KNOWLEDGE_BASES_CONNECT_TIMEOUT_SECONDS`

## Frontend integration

- `NEXT_PUBLIC_API_BASE_URL`
  - Dashboard API origin used from `dash` UI (for example: `https://api.<domain>`).
- `DATABASE_URL`
  - Dashboard Next route handler DB connection string (Prisma).
- `RESOLVEKIT_WEB_SDK_PATH`
  - Filesystem path to local `resolvekit-web-sdk` repo used by docker compose (`docker-compose.yml` and `docker-compose.prod.yml`) to inject/build `@resolvekit/sdk`.
- `IAA_JWT_SECRET`
- `IAA_JWT_ALGORITHM`
- `IAA_JWT_EXPIRE_MINUTES`
  - Dashboard browser-session token settings.
- `IAA_ENCRYPTION_KEY`
  - Used by dashboard API for encrypting/decrypting provider profile API keys (Fernet-compatible).
- `IAA_KNOWLEDGE_BASES_BASE_URL`
- `IAA_KNOWLEDGE_BASES_AUDIENCE`
- `IAA_KNOWLEDGE_BASES_SIGNING_KEY`
- `IAA_KNOWLEDGE_BASES_JWT_ALGORITHM`
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

## Operational Notes

- Production must override insecure defaults for:
  - `IAA_JWT_SECRET`
  - `IAA_ENCRYPTION_KEY`
  - `KBS_SERVICE_JWT_SIGNING_KEY`
  - `KBS_ENCRYPTION_KEY`
- `agent` startup validates critical secrets when debug mode is off.
