# iOS App Agent Capabilities

## Session management and context ingestion

- Router: [`agent/routers/sessions.py`](../../agent/routers/sessions.py)
- Model: [`agent/models/session.py`](../../agent/models/session.py)
- Features:
  - session creation and reuse
  - per-session `client_context`, `llm_context`, and `available_function_names`
  - session history lookup for reconnect and reopen flows

## Chat runtime transport

- Router: [`agent/routers/chat_events.py`](../../agent/routers/chat_events.py)
- Features:
  - persistent session event stream
  - replay by event cursor after reconnect
  - HTTP turn submission and HTTP tool-result submission
  - capability-token gating and chat availability checks

## Orchestration and LLM runtime

- Core module: [`agent/services/orchestrator.py`](../../agent/services/orchestrator.py)
- Event replay store: [`agent/services/event_stream_service.py`](../../agent/services/event_stream_service.py)
