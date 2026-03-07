# Session Event Stream Redis Design

**Goal:** Make `/v1/sessions/{id}/events` deliver live assistant events correctly across multiple backend processes and instances.

## Problem

The current `EventStreamStore` in `agent/services/event_stream_service.py` keeps events and waiters in process memory. That works only when the SSE reader and the turn executor run inside the same Python process. In production, session history proves the agent completes turns, but the iOS client misses live assistant replies because the `/events` request and the turn task are landing on different backend processes.

## Approaches

### 1. Redis Streams

Use Redis as the shared append-only event log. `append()` writes with `XADD`, `replay()` reads with `XRANGE`, and `wait_for_events()` blocks with `XREAD BLOCK`.

Pros:
- Correct across processes and instances
- Natural ordered IDs for SSE `id:` frames
- Built-in replay semantics
- Fits existing repo infrastructure (`IAA_REDIS_URL`, compose files, redis dependency)

Cons:
- Slightly more code than the current in-memory store
- Requires Redis to be available in environments that need distributed correctness

### 2. Database-backed event table

Persist session events in Postgres and poll or listen for new rows.

Pros:
- Fewer moving parts if Redis did not already exist
- Strong persistence

Cons:
- Higher latency / more DB load
- More schema work and cleanup logic
- Worse fit than Redis for blocking stream reads

### 3. Sticky routing only

Keep the in-memory store and force `/events` and `/messages` onto the same backend worker.

Pros:
- Smallest code change

Cons:
- Operationally fragile
- Does not solve replay/shared-state architecture
- Still breaks on restarts or misrouted reconnects

## Recommended Design

Use Redis Streams as the primary event store and keep an in-memory fallback only when Redis is not configured. The API contract stays unchanged.

### Data model

Redis key per app/session:
- `rk:events:{app_id}:{session_id}`

Stored fields per stream entry:
- `turn_id`
- `request_id`
- `timestamp`
- `type`
- `payload` as JSON string

SSE `event_id` becomes the Redis stream entry ID.

### Read/write behavior

- `append()` writes one stream entry with `XADD` and refreshes key TTL.
- `replay(after_event_id)` returns entries after the supplied cursor using `XRANGE`.
- `wait_for_events(after_event_id, timeout)` first replays any buffered entries. If none exist, it blocks on `XREAD` from the latest known stream ID (or the caller cursor) so no events are missed between replay and wait.
- Existing SSE formatting in `chat_events.py` remains unchanged.

### Availability behavior

- If Redis is not configured (`IAA_REDIS_URL` empty), use the current in-memory store. This keeps local unit tests and minimal local setups working.
- If Redis is configured but temporarily unavailable, event delivery should fail loudly rather than silently degrading back to single-process semantics. That preserves correctness in production.

### Cleanup / TTL

- Refresh stream TTL on writes.
- TTL should cover active session lifetime plus reconnect slack. Use `max(session_ttl_minutes * 60, 3600)`.

## Testing

1. Add a failing test proving two independent `EventStreamStore` instances can share events through one Redis-like backend.
2. Add a failing test for blocking reads after replay on the Redis path.
3. Preserve existing memory-store tests for environments without Redis.
4. Run targeted chat transport tests and full backend test suite.
