from pathlib import Path


def test_sse_stream_degrades_on_redis_error_instead_of_crashing() -> None:
    text = Path("agent/routers/chat_events.py").read_text(encoding="utf-8")

    assert "import redis.exceptions as redis_exceptions" in text
    assert "except redis_exceptions.RedisError:" in text


def test_tool_result_resolution_is_resilient_to_transient_redis_errors() -> None:
    text = Path("agent/services/pending_tool_results.py").read_text(encoding="utf-8")

    assert "tool_result_redis_publish_failed" in text
    assert "tool_result_redis_lock_check_failed" in text


def test_orchestrator_does_not_abandon_turn_on_unexpected_tool_wait_failure() -> None:
    text = Path("agent/services/orchestrator.py").read_text(encoding="utf-8")

    assert "tool_call_wait_failed" in text
    assert "failed due to a transient server error" in text
