# Platform Ownership Split

## `agent` (runtime, FastAPI/Python)

Owns all SDK runtime orchestration and transport:

- `/v1/functions`
- `/v1/sessions`
- `/v1/sdk/*`
- `GET /v1/sessions/{session_id}/events`
- `POST /v1/sessions/{session_id}/messages`
- `POST /v1/sessions/{session_id}/tool-results`

## `api` (dashboard backend, Next.js route handlers)

Owns external control-plane routes for dashboard clients.
