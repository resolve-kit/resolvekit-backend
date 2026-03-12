import pytest
from pydantic import ValidationError

from agent.routers.chat_events import ChatMessageBody


def test_chat_message_body_rejects_utf8_payloads_over_byte_limit() -> None:
    oversized = "😀" * 9000

    with pytest.raises(ValidationError):
        ChatMessageBody(text=oversized, request_id="req-1")
