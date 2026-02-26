import uuid

from agent.services.organization_onboarding_service import compute_required_onboarding_steps


def test_compute_required_steps_marks_member_blocked_when_org_profile_missing() -> None:
    steps = compute_required_onboarding_steps(
        has_org_profile=False,
        has_target_app=True,
        has_model_selection=False,
        has_active_api_key=False,
        has_active_function=False,
        can_manage_org=False,
    )

    org_step = next(step for step in steps if step["id"] == "org_llm_provider")
    assert org_step["is_complete"] is False
    assert org_step["is_blocked"] is True
    assert "owner or admin" in (org_step["blocked_reason"] or "").lower()


def test_compute_required_steps_all_complete_when_all_requirements_met() -> None:
    steps = compute_required_onboarding_steps(
        has_org_profile=True,
        has_target_app=True,
        has_model_selection=True,
        has_active_api_key=True,
        has_active_function=True,
        can_manage_org=True,
    )

    assert len(steps) == 5
    assert all(step["is_complete"] for step in steps)
    assert not any(step["is_blocked"] for step in steps)


def test_compute_required_steps_keeps_order_stable() -> None:
    steps = compute_required_onboarding_steps(
        has_org_profile=True,
        has_target_app=False,
        has_model_selection=False,
        has_active_api_key=False,
        has_active_function=False,
        can_manage_org=True,
    )

    assert [step["id"] for step in steps] == [
        "org_llm_provider",
        "create_app",
        "select_model",
        "generate_app_api_key",
        "integrate_sdk_register_functions",
    ]
