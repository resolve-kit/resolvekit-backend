# Service Overview

## Topology

ResolveKit is split into four service roles:

- `dash` (`dashboard/`, Next.js)
- `api` (`dashboard/`, Next.js Route Handlers under `/v1/*`)
- `agent` (`main.py` -> `agent/main.py`, FastAPI)
- `knowledge_bases` (`knowledge_bases/main.py`, FastAPI)

## `agent` ownership

Runtime ownership for SDK clients:

- `/v1/functions`
- `/v1/sessions`
- `/v1/sdk/*`
- `GET /v1/sessions/{session_id}/events`
- `POST /v1/sessions/{session_id}/messages`
- `POST /v1/sessions/{session_id}/tool-results`

## SDK runtime flow

1. SDK calls `agent` with an app API key.
2. Backend creates or reuses a session and returns `events_url` plus `chat_capability_token`.
3. SDK opens one persistent session event stream.
4. User messages and tool results are submitted with HTTP POST requests.
5. Responses, tool calls, completion, and recoverable errors are replayed over the event stream.

See [Orchestrator Flow](orchestrator-flow.md) for turn details.
