from unittest.mock import MagicMock

from ios_app_agent.routers.config import _compute_config_audit_events


def make_cfg(**kwargs):
    cfg = MagicMock()
    defaults = {
        "system_prompt": "Hello",
        "llm_provider": "openai",
        "llm_model": "gpt-4o",
        "llm_api_base": None,
        "temperature": 0.7,
        "max_tokens": 2048,
        "max_tool_rounds": 5,
        "session_ttl_minutes": 60,
        "max_context_messages": 20,
    }
    for key, value in {**defaults, **kwargs}.items():
        setattr(cfg, key, value)
    return cfg


def test_llm_fields_changed():
    old = make_cfg(llm_provider="openai", llm_model="gpt-4o")
    updates = {"llm_provider": "anthropic", "llm_model": "claude-sonnet-4-5"}
    events = _compute_config_audit_events(old, updates, api_key_rotated=False)
    assert any(event["type"] == "config.llm.updated" for event in events)


def test_prompt_changed():
    old = make_cfg(system_prompt="Old prompt")
    updates = {"system_prompt": "New prompt"}
    events = _compute_config_audit_events(old, updates, api_key_rotated=False)
    assert any(event["type"] == "config.prompt.updated" for event in events)


def test_limits_changed():
    old = make_cfg(temperature=0.7)
    updates = {"temperature": 1.0}
    events = _compute_config_audit_events(old, updates, api_key_rotated=False)
    assert any(event["type"] == "config.limits.updated" for event in events)


def test_no_change_no_events():
    old = make_cfg(llm_provider="openai")
    updates = {"llm_provider": "openai"}
    events = _compute_config_audit_events(old, updates, api_key_rotated=False)
    assert events == []


def test_api_key_rotated_emits_llm_event():
    old = make_cfg()
    updates = {}
    events = _compute_config_audit_events(old, updates, api_key_rotated=True)
    assert any(event["type"] == "config.llm.updated" for event in events)
