from pathlib import Path


def test_session_creation_scopes_chat_capability_token_to_session_ttl() -> None:
    text = Path("agent/routers/sessions.py").read_text(encoding="utf-8")

    assert "issue_chat_capability_token(" in text
    assert "ttl_seconds=ttl_minutes * 60" in text
