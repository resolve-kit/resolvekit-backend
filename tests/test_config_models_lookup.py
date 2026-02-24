from unittest.mock import MagicMock, patch

from ios_app_agent.routers.config import _resolve_models_lookup


def make_cfg(**kwargs):
    cfg = MagicMock()
    cfg.llm_provider = "openai"
    cfg.llm_api_base = "https://saved.example.com/v1"
    cfg.llm_api_key_encrypted = "encrypted-key"
    for key, value in kwargs.items():
        setattr(cfg, key, value)
    return cfg


def test_transient_key_is_used_without_decrypt():
    cfg = make_cfg()
    with patch("ios_app_agent.routers.config.decrypt") as decrypt_mock:
        provider, api_key, api_base = _resolve_models_lookup(
            cfg=cfg,
            provider="anthropic",
            llm_api_key="typed-key",
            llm_api_base="https://typed.example.com/v1",
        )
    decrypt_mock.assert_not_called()
    assert provider == "anthropic"
    assert api_key == "typed-key"
    assert api_base == "https://typed.example.com/v1"


def test_saved_key_is_used_when_transient_missing():
    cfg = make_cfg()
    with patch("ios_app_agent.routers.config.decrypt", return_value="saved-key"):
        provider, api_key, api_base = _resolve_models_lookup(
            cfg=cfg,
            provider=None,
            llm_api_key=None,
            llm_api_base=None,
        )
    assert provider == "openai"
    assert api_key == "saved-key"
    assert api_base == "https://saved.example.com/v1"


def test_api_base_can_be_overridden_while_using_saved_key():
    cfg = make_cfg()
    with patch("ios_app_agent.routers.config.decrypt", return_value="saved-key"):
        provider, api_key, api_base = _resolve_models_lookup(
            cfg=cfg,
            provider=None,
            llm_api_key=None,
            llm_api_base="https://override.example.com/v1",
        )
    assert provider == "openai"
    assert api_key == "saved-key"
    assert api_base == "https://override.example.com/v1"
