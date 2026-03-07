# Session Event Stream Redis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the process-local session event store with a Redis-backed shared event stream so live assistant responses reach SSE clients across backend workers.

**Architecture:** Keep the `EventStreamStore` interface stable for the router and sender, but add a Redis-backed implementation under the same interface. Use Redis Streams for ordered IDs, replay, and blocking reads. Retain the existing in-memory implementation only when Redis is not configured.

**Tech Stack:** FastAPI, asyncio, Redis (`redis.asyncio`), pytest

---

### Task 1: Add failing distributed event store tests

**Files:**
- Modify: `tests/test_chat_transport_contract.py`
- Test: `tests/test_chat_transport_contract.py`

**Step 1: Write the failing test**

Add tests that construct two `EventStreamStore` instances backed by the same fake Redis client and assert that one instance can append while the other replays and waits for the new events.

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_chat_transport_contract.py -k redis`
Expected: FAIL because `EventStreamStore` does not yet support a shared Redis backend.

**Step 3: Write minimal implementation**

Update `agent/services/event_stream_service.py` to accept an injected async Redis client factory and route operations through Redis Streams when enabled.

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_chat_transport_contract.py -k redis`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_chat_transport_contract.py agent/services/event_stream_service.py
git commit -m "fix: back session event stream with redis"
```

### Task 2: Preserve local fallback behavior

**Files:**
- Modify: `agent/services/event_stream_service.py`
- Test: `tests/test_chat_transport_contract.py`

**Step 1: Write the failing test**

Add or keep a test proving replay/wait semantics still work when Redis is disabled.

**Step 2: Run test to verify it fails if fallback breaks**

Run: `uv run pytest -q tests/test_chat_transport_contract.py -k "event_stream_store_replays or event_stream_store_notifies"`
Expected: PASS before refactor, and remain PASS after Redis integration.

**Step 3: Write minimal implementation**

Keep the existing in-memory store as a fallback path only when Redis is not configured.

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_chat_transport_contract.py -k "event_stream_store_replays or event_stream_store_notifies"`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_chat_transport_contract.py agent/services/event_stream_service.py
git commit -m "test: preserve local event stream fallback"
```

### Task 3: Wire Redis client access cleanly

**Files:**
- Modify: `agent/services/runtime_redis_service.py`
- Modify: `agent/services/event_stream_service.py`
- Test: `tests/test_chat_transport_contract.py`

**Step 1: Write the failing test**

Add a test for the production configuration path: when Redis is declared enabled but unavailable, event delivery raises instead of silently falling back.

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_chat_transport_contract.py -k unavailable`
Expected: FAIL until the Redis-required path is implemented.

**Step 3: Write minimal implementation**

Expose a public Redis client accessor from `runtime_redis_service.py` and raise a clear runtime error from the event store when Redis is configured but unavailable.

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_chat_transport_contract.py -k unavailable`
Expected: PASS

**Step 5: Commit**

```bash
git add agent/services/runtime_redis_service.py agent/services/event_stream_service.py tests/test_chat_transport_contract.py
git commit -m "fix: fail fast when shared event stream redis is unavailable"
```

### Task 4: Full verification

**Files:**
- Modify if needed: `agent/routers/chat_events.py`
- Test: `tests/test_chat_transport_contract.py`
- Test: full backend suite

**Step 1: Run targeted transport tests**

Run: `uv run pytest -q tests/test_chat_transport_contract.py`
Expected: PASS

**Step 2: Run full suite**

Run: `uv run pytest -q`
Expected: PASS

**Step 3: Check OpenAPI sync if router surface changed**

Run: `uv run python scripts/check_openapi_sync.py`
Expected: PASS

**Step 4: Commit**

```bash
git add agent/services/event_stream_service.py agent/services/runtime_redis_service.py tests/test_chat_transport_contract.py docs/plans/2026-03-06-session-event-stream-redis-design.md docs/plans/2026-03-06-session-event-stream-redis-implementation.md
git commit -m "fix: use redis-backed session event streams"
```
