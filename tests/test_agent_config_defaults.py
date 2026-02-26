from agent.models.agent_config import AgentConfig


def test_scope_mode_column_default_is_strict() -> None:
    column = AgentConfig.__table__.c.scope_mode
    assert column.default is not None
    assert column.default.arg == "strict"


def test_system_prompt_default_is_product_generic() -> None:
    column = AgentConfig.__table__.c.system_prompt
    assert column.default is not None
    default_prompt = str(column.default.arg)
    assert "software product" in default_prompt
    assert "on-device assistant" not in default_prompt
    assert "iOS device" not in default_prompt
    assert "Use available tools when an action or real-time check is required." not in default_prompt
    assert "Prefer grounded information from provided documentation and workflows over guessing." not in default_prompt
