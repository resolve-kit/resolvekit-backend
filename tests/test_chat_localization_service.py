from types import SimpleNamespace

from agent.services.chat_localization_service import effective_texts, resolve_locale, sanitize_overrides_for_storage


def test_resolve_locale_exact_match() -> None:
    assert resolve_locale("pt-br", []) == "pt-br"


def test_resolve_locale_prefers_alias() -> None:
    assert resolve_locale("zh-hans", []) == "zh-cn"
    assert resolve_locale("zh-hant", []) == "zh-tw"


def test_resolve_locale_falls_back_to_base_language() -> None:
    assert resolve_locale("en-us", []) == "en"


def test_resolve_locale_uses_preferred_locales() -> None:
    assert resolve_locale(None, ["xx", "es-ar", "en"]) == "es-ar"


def test_resolve_locale_defaults_to_english() -> None:
    assert resolve_locale(None, ["xx-yy"]) == "en"


def test_sanitize_overrides_keeps_only_supported_diffs() -> None:
    payload = {
        "en_US": {
            "chat_title": "My Chat",
            "message_placeholder": "Message",
            "initial_message": "Hello! How can I help you today?",
        },
        "xx": {"chat_title": "Ignored", "message_placeholder": "Ignored", "initial_message": "Ignored"},
    }
    assert sanitize_overrides_for_storage(payload) == {"en": {"chat_title": "My Chat"}}


def test_effective_texts_merge_defaults_and_overrides() -> None:
    app = SimpleNamespace(chat_localization_overrides={"fr": {"chat_title": "Assistance"}})
    texts = effective_texts(app, "fr")
    assert texts["chat_title"] == "Assistance"
    assert texts["message_placeholder"] == "Message"
