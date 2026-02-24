import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer, require_app_ownership
from ios_app_agent.models.agent_config import AgentConfig
from ios_app_agent.models.app import App
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
from ios_app_agent.schemas.agent_config import (
    AgentConfigOut,
    AgentConfigUpdate,
    ConnectionTestRequest,
    ConnectionTestResult,
    ModelsLookupRequest,
    ModelsResponse,
    ProviderInfo,
)
from ios_app_agent.services.audit_service import AuditService
from ios_app_agent.services.encryption import decrypt
from ios_app_agent.services.provider_service import (
    list_models_for_provider,
    list_providers,
    test_provider_connection,
)

router = APIRouter(prefix="/v1/apps/{app_id}/config", tags=["config"])

_LLM_FIELDS = {"llm_profile_id", "llm_model"}
_PROMPT_FIELDS = {"system_prompt"}
_LIMITS_FIELDS = {
    "temperature",
    "max_tokens",
    "max_tool_rounds",
    "session_ttl_minutes",
    "max_context_messages",
}


def _json_safe(value: object) -> object:
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _compute_config_audit_events(
    old_cfg: AgentConfig,
    updates: dict[str, object],
) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []

    llm_before = {field: _json_safe(getattr(old_cfg, field)) for field in _LLM_FIELDS}
    llm_after = {field: _json_safe(updates.get(field, getattr(old_cfg, field))) for field in _LLM_FIELDS}
    if llm_before != llm_after:
        events.append({"type": "config.llm.updated", "diff": {"before": llm_before, "after": llm_after}})

    prompt_before = {field: _json_safe(getattr(old_cfg, field)) for field in _PROMPT_FIELDS}
    prompt_after = {field: _json_safe(updates.get(field, getattr(old_cfg, field))) for field in _PROMPT_FIELDS}
    if prompt_before != prompt_after:
        events.append(
            {
                "type": "config.prompt.updated",
                "diff": {"before": prompt_before, "after": prompt_after},
            }
        )

    limits_before = {field: _json_safe(getattr(old_cfg, field)) for field in _LIMITS_FIELDS}
    limits_after = {field: _json_safe(updates.get(field, getattr(old_cfg, field))) for field in _LIMITS_FIELDS}
    if limits_before != limits_after:
        events.append(
            {
                "type": "config.limits.updated",
                "diff": {"before": limits_before, "after": limits_after},
            }
        )

    return events


def _resolve_models_lookup(
    cfg: AgentConfig,
    provider: str | None,
    llm_api_key: str | None,
    llm_api_base: str | None,
) -> tuple[str, str | None, str | None]:
    provider_id = provider or cfg.llm_provider
    api_key = llm_api_key
    if not api_key and cfg.llm_api_key_encrypted:
        api_key = decrypt(cfg.llm_api_key_encrypted)

    api_base = llm_api_base if llm_api_base is not None else cfg.llm_api_base
    return provider_id, api_key, api_base


def config_to_out(cfg: AgentConfig, profile: OrganizationLLMProviderProfile | None) -> AgentConfigOut:
    return AgentConfigOut(
        id=cfg.id,
        app_id=cfg.app_id,
        system_prompt=cfg.system_prompt,
        llm_profile_id=cfg.llm_profile_id,
        llm_profile_name=profile.name if profile else None,
        llm_provider=profile.provider if profile else None,
        llm_model=cfg.llm_model,
        has_llm_api_key=bool(profile and profile.api_key_encrypted),
        llm_api_base=profile.api_base if profile else None,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        max_tool_rounds=cfg.max_tool_rounds,
        session_ttl_minutes=cfg.session_ttl_minutes,
        max_context_messages=cfg.max_context_messages,
    )


async def _get_or_create_config(db: AsyncSession, app_id: uuid.UUID) -> AgentConfig:
    result = await db.execute(select(AgentConfig).where(AgentConfig.app_id == app_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = AgentConfig(app_id=app_id)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


async def _get_profile_for_app(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> OrganizationLLMProviderProfile:
    profile = await db.get(OrganizationLLMProviderProfile, profile_id)
    if profile is None or profile.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM profile not found")
    return profile


async def _get_selected_profile(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    cfg: AgentConfig,
) -> OrganizationLLMProviderProfile | None:
    if cfg.llm_profile_id is None:
        return None
    return await _get_profile_for_app(db, organization_id=organization_id, profile_id=cfg.llm_profile_id)


async def _resolve_models_lookup_for_app(
    db: AsyncSession,
    *,
    app: App,
    cfg: AgentConfig,
    provider: str | None,
    llm_api_key: str | None,
    llm_api_base: str | None,
) -> tuple[str, str | None, str | None]:
    if provider or llm_api_key is not None or llm_api_base is not None:
        return _resolve_models_lookup(
            cfg=cfg,
            provider=provider,
            llm_api_key=llm_api_key,
            llm_api_base=llm_api_base,
        )

    if cfg.llm_profile_id is not None:
        profile = await _get_profile_for_app(
            db,
            organization_id=app.organization_id,
            profile_id=cfg.llm_profile_id,
        )
        return profile.provider, decrypt(profile.api_key_encrypted), profile.api_base

    return _resolve_models_lookup(
        cfg=cfg,
        provider=provider,
        llm_api_key=llm_api_key,
        llm_api_base=llm_api_base,
    )


@router.get("", response_model=AgentConfigOut)
async def get_config(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    cfg = await _get_or_create_config(db, app_id)
    profile = await _get_selected_profile(db, organization_id=app.organization_id, cfg=cfg)
    return config_to_out(cfg, profile)


@router.put("", response_model=AgentConfigOut)
async def update_config(
    app_id: uuid.UUID,
    body: AgentConfigUpdate,
    request: Request,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    cfg = await _get_or_create_config(db, app_id)

    updates = body.model_dump(exclude_unset=True)
    if "llm_model" in updates and updates["llm_model"] is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="LLM model is required")
    if "llm_profile_id" in updates and updates["llm_profile_id"] is not None:
        await _get_profile_for_app(
            db,
            organization_id=app.organization_id,
            profile_id=updates["llm_profile_id"],  # type: ignore[arg-type]
        )

    audit_events = _compute_config_audit_events(cfg, updates)

    for field, value in updates.items():
        setattr(cfg, field, value)

    await db.commit()
    await db.refresh(cfg)

    ip_address = request.client.host if request.client else None
    for event in audit_events:
        await AuditService.emit(
            db=db,
            app_id=app_id,
            actor_email=developer.email,
            event_type=event["type"],  # type: ignore[arg-type]
            diff=event["diff"],  # type: ignore[arg-type]
            ip_address=ip_address,
        )

    if audit_events:
        await db.commit()

    profile = await _get_selected_profile(db, organization_id=app.organization_id, cfg=cfg)
    return config_to_out(cfg, profile)


@router.get("/providers", response_model=list[ProviderInfo])
async def get_providers(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)
    return list_providers()


@router.get("/models", response_model=ModelsResponse)
async def get_models(
    app_id: uuid.UUID,
    provider: str | None = Query(default=None),
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    cfg = await _get_or_create_config(db, app_id)
    provider_id, api_key, api_base = await _resolve_models_lookup_for_app(
        db,
        app=app,
        cfg=cfg,
        provider=provider,
        llm_api_key=None,
        llm_api_base=None,
    )

    models, is_dynamic, error = await list_models_for_provider(provider_id, api_key, api_base)

    return ModelsResponse(provider=provider_id, models=models, is_dynamic=is_dynamic, error=error)


@router.post("/models", response_model=ModelsResponse)
async def get_models_with_transient_key(
    app_id: uuid.UUID,
    body: ModelsLookupRequest,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    cfg = await _get_or_create_config(db, app_id)
    provider_id, api_key, api_base = await _resolve_models_lookup_for_app(
        db,
        app=app,
        cfg=cfg,
        provider=body.provider,
        llm_api_key=body.llm_api_key,
        llm_api_base=body.llm_api_base,
    )

    models, is_dynamic, error = await list_models_for_provider(provider_id, api_key, api_base)
    return ModelsResponse(provider=provider_id, models=models, is_dynamic=is_dynamic, error=error)


@router.post("/test", response_model=ConnectionTestResult)
async def test_connection(
    app_id: uuid.UUID,
    body: ConnectionTestRequest,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    cfg = await _get_or_create_config(db, app_id)

    _, api_key, _ = await _resolve_models_lookup_for_app(
        db,
        app=app,
        cfg=cfg,
        provider=body.provider,
        llm_api_key=body.llm_api_key,
        llm_api_base=body.llm_api_base,
    )

    result = await test_provider_connection(body.provider, api_key, body.llm_api_base)
    return ConnectionTestResult(**result)
