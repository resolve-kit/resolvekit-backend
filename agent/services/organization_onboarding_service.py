import uuid
from datetime import datetime, timezone
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.models.agent_config import AgentConfig
from agent.models.api_key import ApiKey
from agent.models.app import App
from agent.models.developer import DeveloperAccount
from agent.models.function_registry import RegisteredFunction
from agent.models.organization import Organization
from agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
from agent.services.authorization_service import ORG_ADMIN_ROLES


class OnboardingStep(TypedDict):
    id: str
    title: str
    description: str
    route: str
    is_complete: bool
    is_blocked: bool
    blocked_reason: str | None


class OnboardingTip(TypedDict):
    id: str
    title: str
    description: str
    route: str


def compute_required_onboarding_steps(
    *,
    has_org_profile: bool,
    has_target_app: bool,
    has_model_selection: bool,
    has_active_api_key: bool,
    has_active_function: bool,
    can_manage_org: bool,
    target_app_id: uuid.UUID | None = None,
) -> list[OnboardingStep]:
    target_route = f"/apps/{target_app_id}" if target_app_id else "/apps"

    return [
        {
            "id": "org_llm_provider",
            "title": "Set up organization LLM provider",
            "description": "Add provider credentials at organization level so apps can reuse them.",
            "route": "/organization",
            "is_complete": has_org_profile,
            "is_blocked": (not has_org_profile) and (not can_manage_org),
            "blocked_reason": (
                "Ask an organization owner or admin to configure the LLM provider first."
                if (not has_org_profile and not can_manage_org)
                else None
            ),
        },
        {
            "id": "create_app",
            "title": "Create your first app",
            "description": "Create the app workspace where agent behavior and SDK integration are configured.",
            "route": "/apps",
            "is_complete": has_target_app,
            "is_blocked": False,
            "blocked_reason": None,
        },
        {
            "id": "select_model",
            "title": "Select app model",
            "description": "Pick the organization profile and model this app should use for conversations.",
            "route": f"{target_route}/llm" if target_app_id else "/apps",
            "is_complete": has_model_selection,
            "is_blocked": False,
            "blocked_reason": None,
        },
        {
            "id": "generate_app_api_key",
            "title": "Generate app API key",
            "description": "Create an app API key the SDK will use to authenticate with backend endpoints.",
            "route": f"{target_route}/api-keys" if target_app_id else "/apps",
            "is_complete": has_active_api_key,
            "is_blocked": False,
            "blocked_reason": None,
        },
        {
            "id": "integrate_sdk_register_functions",
            "title": "Integrate SDK and register functions",
            "description": "Integrate the SDK in your app and verify at least one active function appears.",
            "route": f"{target_route}/functions" if target_app_id else "/apps",
            "is_complete": has_active_function,
            "is_blocked": False,
            "blocked_reason": None,
        },
    ]


def build_optional_tips(target_app_id: uuid.UUID | None) -> list[OnboardingTip]:
    target_route = f"/apps/{target_app_id}" if target_app_id else "/apps"
    return [
        {
            "id": "agent_prompt_tip",
            "title": "Tip: tune agent prompt",
            "description": "Use Agent Prompt to define guardrails, tone, and scope so answers stay product-focused.",
            "route": f"{target_route}/agent" if target_app_id else "/apps",
        },
        {
            "id": "playbooks_tip",
            "title": "Tip: use playbooks for guided flows",
            "description": "Playbooks orchestrate function sequences so the assistant follows reliable, repeatable workflows.",
            "route": f"{target_route}/playbooks" if target_app_id else "/apps",
        },
        {
            "id": "knowledge_bases_tip",
            "title": "Tip: assign knowledge bases",
            "description": "Knowledge bases ground answers in your docs and reduce hallucinations for support and product Q&A.",
            "route": "/knowledge-bases",
        },
    ]


async def resolve_onboarding_state(
    *,
    db: AsyncSession,
    developer: DeveloperAccount,
) -> dict[str, object]:
    if developer.organization_id is None:
        raise ValueError("Developer must belong to an organization")

    organization = await db.get(Organization, developer.organization_id)
    if organization is None:
        raise ValueError("Organization not found")

    target_app: App | None = None
    dirty = False

    if organization.onboarding_target_app_id is not None:
        candidate = await db.get(App, organization.onboarding_target_app_id)
        if candidate is not None and candidate.organization_id == organization.id:
            target_app = candidate

    if target_app is None:
        result = await db.execute(
            select(App)
            .where(App.organization_id == organization.id)
            .order_by(App.created_at.asc(), App.id.asc())
            .limit(1)
        )
        target_app = result.scalar_one_or_none()
        next_target_id = target_app.id if target_app else None
        if organization.onboarding_target_app_id != next_target_id:
            organization.onboarding_target_app_id = next_target_id
            dirty = True

    has_org_profile = bool(
        (
            await db.execute(
                select(OrganizationLLMProviderProfile.id)
                .where(OrganizationLLMProviderProfile.organization_id == organization.id)
                .limit(1)
            )
        ).scalar_one_or_none()
    )

    has_target_app = target_app is not None
    has_model_selection = False
    has_active_api_key = False
    has_active_function = False

    if target_app is not None:
        config = (
            await db.execute(select(AgentConfig).where(AgentConfig.app_id == target_app.id).limit(1))
        ).scalar_one_or_none()
        has_model_selection = bool(
            config is not None
            and config.llm_profile_id is not None
            and config.llm_model
            and config.llm_model.strip()
        )

        has_active_api_key = bool(
            (
                await db.execute(
                    select(ApiKey.id)
                    .where(ApiKey.app_id == target_app.id, ApiKey.is_active.is_(True))
                    .limit(1)
                )
            ).scalar_one_or_none()
        )

        has_active_function = bool(
            (
                await db.execute(
                    select(RegisteredFunction.id)
                    .where(RegisteredFunction.app_id == target_app.id, RegisteredFunction.is_active.is_(True))
                    .limit(1)
                )
            ).scalar_one_or_none()
        )

    can_manage_org = developer.role in ORG_ADMIN_ROLES

    required_steps = compute_required_onboarding_steps(
        has_org_profile=has_org_profile,
        has_target_app=has_target_app,
        has_model_selection=has_model_selection,
        has_active_api_key=has_active_api_key,
        has_active_function=has_active_function,
        can_manage_org=can_manage_org,
        target_app_id=target_app.id if target_app else None,
    )

    all_required_complete = all(step["is_complete"] for step in required_steps)
    if all_required_complete and organization.onboarding_completed_at is None:
        organization.onboarding_completed_at = datetime.now(timezone.utc)
        dirty = True

    if dirty:
        await db.commit()
        await db.refresh(organization)

    is_complete = organization.onboarding_completed_at is not None

    return {
        "organization_id": organization.id,
        "is_complete": is_complete,
        "should_show": not is_complete,
        "can_reset": can_manage_org,
        "target_app_id": target_app.id if target_app else None,
        "target_app_name": target_app.name if target_app else None,
        "required_steps": required_steps,
        "optional_tips": build_optional_tips(target_app.id if target_app else None),
    }
