# Environment Reference

Settings are loaded via pydantic settings models:

- `ios_app_agent`: [`ios_app_agent/config.py`](../../ios_app_agent/config.py), prefix `IAA_`
- `kb_service`: [`kb_service/config.py`](../../kb_service/config.py), prefix `KBS_`

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

- `IAA_KB_SERVICE_BASE_URL`
- `IAA_KB_SERVICE_AUDIENCE`
- `IAA_KB_SERVICE_SIGNING_KEY`
- `IAA_KB_SERVICE_JWT_ALGORITHM`
- `IAA_KB_SERVICE_TIMEOUT_SECONDS`
- `IAA_KB_SERVICE_CONNECT_TIMEOUT_SECONDS`

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

## Defaults and examples

- See `.env.example` and `docker-compose.yml` for local defaults and service wiring.

## Operational Notes

- Production must override insecure defaults for:
  - `IAA_JWT_SECRET`
  - `IAA_ENCRYPTION_KEY`
  - `KBS_SERVICE_JWT_SIGNING_KEY`
  - `KBS_ENCRYPTION_KEY`
- `ios_app_agent` startup validates critical secrets when debug mode is off.

