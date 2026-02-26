import pytest
from pydantic import ValidationError

from agent.schemas.session import SessionCreate


def test_session_create_accepts_llm_context_full_json() -> None:
    payload = SessionCreate(
        llm_context={
            "location": {
                "city": "Vilnius",
                "country": "LT",
                "coordinates": [54.6872, 25.2797],
            },
            "network_type": "wifi",
            "is_traveling": False,
            "recent_errors": ["E_TIMEOUT", "E_RETRY"],
            "signal_strength": -61,
        }
    )

    assert payload.llm_context["location"]["city"] == "Vilnius"
    assert payload.llm_context["network_type"] == "wifi"
    assert payload.llm_context["is_traveling"] is False


def test_session_create_rejects_too_many_llm_context_keys() -> None:
    too_many = {f"k{i}": i for i in range(51)}

    with pytest.raises(ValidationError, match="at most 50 top-level keys"):
        SessionCreate(llm_context=too_many)


def test_session_create_rejects_llm_context_key_too_long() -> None:
    with pytest.raises(ValidationError, match="keys must be <= 64 chars"):
        SessionCreate(llm_context={"x" * 65: "value"})


def test_session_create_rejects_llm_context_payload_too_large() -> None:
    oversized = {"blob": "x" * 9000}

    with pytest.raises(ValidationError, match="must not exceed 8192 bytes"):
        SessionCreate(llm_context=oversized)


def test_session_create_reuses_active_session_by_default() -> None:
    payload = SessionCreate()

    assert payload.reuse_active_session is True


def test_session_create_accepts_locale_preferences() -> None:
    payload = SessionCreate(locale="fr", preferred_locales=["fr-FR", "en-US"])
    assert payload.locale == "fr"
    assert payload.preferred_locales == ["fr-FR", "en-US"]
