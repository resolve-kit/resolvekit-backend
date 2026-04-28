# Local Dev + Docker Runbook

## Docker-first setup

1. Configure `.env`.
2. Build the local web SDK package if dashboard/api containers need it.
3. Start stack: `docker compose up --build -d`
4. Check health: `curl -s http://localhost:8000/health`

## Local deploy notes

### Single-host quickstart

The local deploy templates are optimized for one public host:

- dashboard UI at `/`
- dashboard control-plane API at `/v1/*`
- agent runtime at `/agent/v1/*`

This keeps self-host setup simple and avoids mandatory multi-origin DNS/TLS/CORS work.

### Recommended production topology

For larger or multi-region deployments, prefer separate public hosts:

- `console.<domain>` for the dashboard shell
- `api.<domain>` for dashboard control-plane routes
- `agent.<domain>` for runtime session traffic

This is the better fit when you want region-aware routing, different failover policies, or separate edge treatment for streaming runtime traffic.

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
