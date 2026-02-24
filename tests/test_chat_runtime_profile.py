from types import SimpleNamespace

from ios_app_agent.services.chat_access_service import apply_runtime_llm_profile


def test_apply_runtime_llm_profile_preserves_selected_model() -> None:
    agent_config = SimpleNamespace(
        llm_provider="openai",
        llm_model="claude-3-5-sonnet",
        llm_api_key_encrypted=None,
        llm_api_base=None,
    )
    profile = SimpleNamespace(
        provider="openai",
        model="default",
        api_key_encrypted="encrypted-key",
        api_base="https://api.provider.test/v1",
    )

    apply_runtime_llm_profile(agent_config, profile)

    assert agent_config.llm_provider == "openai"
    assert agent_config.llm_model == "claude-3-5-sonnet"
    assert agent_config.llm_api_key_encrypted == "encrypted-key"
    assert agent_config.llm_api_base == "https://api.provider.test/v1"
