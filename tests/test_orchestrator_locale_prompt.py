from agent.services.orchestrator import _assemble_system_prompt


def test_system_prompt_contains_language_section() -> None:
    prompt = _assemble_system_prompt(
        dev_prompt="",
        scope_mode="strict",
        platform_context="",
        language_context="Locale: fr",
        custom_context="",
        kb_context="",
        playbook_prompt="",
    )
    assert "## Language" in prompt
    assert "Locale: fr" in prompt
