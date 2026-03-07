# Local Dev + Docker Runbook

## Docker-first setup

1. Configure `.env`.
2. Build the local web SDK package if dashboard/api containers need it.
3. Start stack: `docker compose up --build -d`
4. Check health: `curl -s http://localhost:8000/health`

## Local deploy notes

The SDK-facing host must preserve long-lived HTTP responses for:

- `GET /v1/sessions/{id}/events`
- `POST /v1/sessions/{id}/messages`
- `POST /v1/sessions/{id}/tool-results`

For local or production ingress:

- keep idle/read timeouts high enough for the event stream
- do not buffer the event-stream response
- support TLS and HTTP/3 at the edge if you want `URLSession` to negotiate it automatically

## Validation commands

- Backend tests: `uv run python -m pytest`
- OpenAPI sync: `uv run python scripts/check_openapi_sync.py`
- OpenAPI export: `uv run python scripts/export_openapi.py`

## Common issues

- `chat_unavailable`: check integration status and LLM profile assignment.
- `404` on tool result submit: stale `turn_id` or already-resolved `call_id`.
- reconnect loops: ensure ingress is not buffering or timing out `GET /events`.
