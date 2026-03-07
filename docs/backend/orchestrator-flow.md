# Orchestrator Flow

The runtime orchestrator lives in [`agent/services/orchestrator.py`](../../agent/services/orchestrator.py).

## Turn lifecycle

1. Persist user message.
2. Load routing, KB, playbook, and session context.
3. Build the enriched system prompt.
4. Call the model.
5. Emit runtime events through the session event stream sender.
6. Await SDK tool results when needed.
7. Persist final assistant output and emit `turn_complete`.

## Transport coupling

The orchestrator is transport-agnostic behind `MessageSender`.

Current runtime transport implementation:

- event sender: [`agent/routers/chat_events.py`](../../agent/routers/chat_events.py)
- replay store: [`agent/services/event_stream_service.py`](../../agent/services/event_stream_service.py)
