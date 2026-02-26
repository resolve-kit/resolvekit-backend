import pytest
from fastapi import HTTPException

from agent.services.chat_theme_service import (
    CHAT_THEME_TOKEN_KEYS,
    default_chat_theme,
    normalize_chat_theme,
)


def test_default_chat_theme_contains_required_palettes_and_tokens() -> None:
    theme = default_chat_theme()
    assert set(theme.keys()) == {"light", "dark"}
    assert set(theme["light"].keys()) == set(CHAT_THEME_TOKEN_KEYS)
    assert set(theme["dark"].keys()) == set(CHAT_THEME_TOKEN_KEYS)


def test_normalize_chat_theme_uppercases_hex_values() -> None:
    theme = default_chat_theme()
    theme["light"]["titleText"] = "#abcdef"
    theme["dark"]["titleText"] = "#abcd1234"

    normalized = normalize_chat_theme(theme)
    assert normalized["light"]["titleText"] == "#ABCDEF"
    assert normalized["dark"]["titleText"] == "#ABCD1234"


def test_normalize_chat_theme_rejects_invalid_hex() -> None:
    theme = default_chat_theme()
    theme["light"]["titleText"] = "blue"

    with pytest.raises(HTTPException) as exc_info:
        normalize_chat_theme(theme)

    assert exc_info.value.status_code == 422
    assert "must be #RRGGBB or #RRGGBBAA" in str(exc_info.value.detail)
