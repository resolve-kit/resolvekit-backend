import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

from ios_app_agent.routers.config import _compute_config_audit_events, config_to_out


def make_cfg(**kwargs):
    cfg = MagicMock()
    defaults = {
        "system_prompt": "Hello",
        "scope_mode": "open",
        "llm_profile_id": None,
        "llm_model": "gpt-4o",
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
    old = make_cfg(llm_profile_id=None)
    updates = {"llm_profile_id": "8b9c6ef2-6f38-4721-b53b-71f4cad08f2a"}
    events = _compute_config_audit_events(old, updates)
    assert any(event["type"] == "config.llm.updated" for event in events)


def test_llm_model_changed():
    old = make_cfg(llm_profile_id="8b9c6ef2-6f38-4721-b53b-71f4cad08f2a", llm_model="gpt-4o")
    updates = {"llm_model": "gpt-4o-mini"}
    events = _compute_config_audit_events(old, updates)
    assert any(event["type"] == "config.llm.updated" for event in events)


def test_prompt_changed():
    old = make_cfg(system_prompt="Old prompt")
    updates = {"system_prompt": "New prompt"}
    events = _compute_config_audit_events(old, updates)
    assert any(event["type"] == "config.prompt.updated" for event in events)


def test_scope_mode_changed_is_prompt_event():
    old = make_cfg(scope_mode="open")
    updates = {"scope_mode": "strict"}
    events = _compute_config_audit_events(old, updates)
    assert any(event["type"] == "config.prompt.updated" for event in events)


def test_limits_changed():
    old = make_cfg(temperature=0.7)
    updates = {"temperature": 1.0}
    events = _compute_config_audit_events(old, updates)
    assert any(event["type"] == "config.limits.updated" for event in events)


def test_no_change_no_events():
    old = make_cfg(llm_profile_id=None)
    updates = {"llm_profile_id": None}
    events = _compute_config_audit_events(old, updates)
    assert events == []


def test_llm_profile_uuid_diff_is_json_serializable():
    old = make_cfg(llm_profile_id=uuid.uuid4())
    updates = {"llm_profile_id": uuid.uuid4()}
    events = _compute_config_audit_events(old, updates)
    llm_event = next(event for event in events if event["type"] == "config.llm.updated")
    json.dumps(llm_event["diff"])


def test_config_to_out_includes_scope_mode():
    cfg = SimpleNamespace(
        id=uuid.uuid4(),
        app_id=uuid.uuid4(),
        system_prompt="Support prompt",
        scope_mode="strict",
        llm_profile_id=None,
        llm_model="gpt-4o",
        temperature=0.7,
        max_tokens=2048,
        max_tool_rounds=6,
        session_ttl_minutes=60,
        max_context_messages=20,
    )

    out = config_to_out(cfg, None)

    assert out.scope_mode == "strict"
