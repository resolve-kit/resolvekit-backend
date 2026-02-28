from agent.services import orchestrator


def test_router_prompt_marks_greetings_as_in_scope() -> None:
    prompt = orchestrator.ROUTER_SYSTEM_PROMPT
    assert "Greetings and brief social niceties" in prompt
    assert "in_scope should be true" in prompt


def test_router_prompt_requires_specific_rejection_for_product_finding_requests() -> None:
    prompt = orchestrator.ROUTER_SYSTEM_PROMPT
    assert "find or choose products on the user's behalf" in prompt
    assert "ask the user to share a" in prompt
    assert "specific product URL they want to track" in prompt


def test_router_prompt_marks_support_contact_questions_as_kb_needed() -> None:
    prompt = orchestrator.ROUTER_SYSTEM_PROMPT
    assert "support contact details" in prompt
    assert "support email" in prompt
    assert "needs_kb should be true" in prompt


def test_router_prompt_requires_using_recent_conversation_for_ambiguous_followups() -> None:
    prompt = orchestrator.ROUTER_SYSTEM_PROMPT
    assert "Use recent conversation context to resolve ambiguous follow-ups." in prompt
    assert "yes" in prompt
    assert "this one" in prompt
