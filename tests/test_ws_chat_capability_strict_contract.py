from pathlib import Path


def test_websocket_router_uses_strict_chat_capability_validation() -> None:
    text = Path("agent/routers/chat_ws.py").read_text(encoding="utf-8")
    assert "validate_chat_capability_token" in text
    assert "validate_ws_chat_capability_token" not in text


def test_chat_access_service_does_not_expose_ws_validation_bypass_helper() -> None:
    text = Path("agent/services/chat_access_service.py").read_text(encoding="utf-8")
    assert "def validate_ws_chat_capability_token(" not in text
