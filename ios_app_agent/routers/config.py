import uuid

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.config import settings
from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer, require_app_ownership
from ios_app_agent.models.agent_config import AgentConfig
from ios_app_agent.models.app import App
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.schemas.agent_config import (
    AgentConfigOut,
    AgentConfigUpdate,
    ConnectionTestRequest,
    ConnectionTestResult,
    ModelsLookupRequest,
    ModelsResponse,
    ProviderInfo,
)
from ios_app_agent.services.encryption import decrypt
from ios_app_agent.services.provider_service import (
    list_models_for_provider,
    list_providers,
    test_provider_connection,
)
from ios_app_agent.services.audit_service import AuditService

router = APIRouter(prefix="/v1/apps/{app_id}/config", tags=["config"])

_LLM_FIELDS = {"llm_provider", "llm_model", "llm_api_base"}
_PROMPT_FIELDS = {"system_prompt"}
_LIMITS_FIELDS = {
    "temperature",
    "max_tokens",
    "max_tool_rounds",
    "session_ttl_minutes",
    "max_context_messages",
}


def _compute_config_audit_events(
    old_cfg: AgentConfig,
    updates: dict[str, object],
    api_key_rotated: bool,
) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []

    llm_before = {field: getattr(old_cfg, field) for field in _LLM_FIELDS}
    llm_after = {field: updates.get(field, getattr(old_cfg, field)) for field in _LLM_FIELDS}
    if llm_before != llm_after or api_key_rotated:
        diff: dict[str, object] = {"before": llm_before, "after": llm_after}
        if api_key_rotated:
            diff["api_key_rotated"] = True
        events.append({"type": "config.llm.updated", "diff": diff})

    prompt_before = {field: getattr(old_cfg, field) for field in _PROMPT_FIELDS}
    prompt_after = {field: updates.get(field, getattr(old_cfg, field)) for field in _PROMPT_FIELDS}
    if prompt_before != prompt_after:
        events.append(
            {
                "type": "config.prompt.updated",
                "diff": {"before": prompt_before, "after": prompt_after},
            }
        )

    limits_before = {field: getattr(old_cfg, field) for field in _LIMITS_FIELDS}
    limits_after = {field: updates.get(field, getattr(old_cfg, field)) for field in _LIMITS_FIELDS}
    if limits_before != limits_after:
        events.append(
            {
                "type": "config.limits.updated",
                "diff": {"before": limits_before, "after": limits_after},
            }
        )

    return events


def encrypt_key(plain: str) -> str:
    f = Fernet(settings.encryption_key.encode())
    return f.encrypt(plain.encode()).decode()


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


def config_to_out(cfg: AgentConfig) -> AgentConfigOut:
    return AgentConfigOut(
        id=cfg.id,
        app_id=cfg.app_id,
        system_prompt=cfg.system_prompt,
        llm_provider=cfg.llm_provider,
        llm_model=cfg.llm_model,
        has_llm_api_key=cfg.llm_api_key_encrypted is not None,
        llm_api_base=cfg.llm_api_base,
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
    return config_to_out(cfg)


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
    api_key_rotated = False
    if "llm_api_key" in updates:
        llm_key = updates.pop("llm_api_key")
        if llm_key:
            cfg.llm_api_key_encrypted = encrypt_key(llm_key)
            api_key_rotated = True
        else:
            cfg.llm_api_key_encrypted = None

    audit_events = _compute_config_audit_events(cfg, updates, api_key_rotated)

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

    return config_to_out(cfg)


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
    provider_id, api_key, api_base = _resolve_models_lookup(
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
    provider_id, api_key, api_base = _resolve_models_lookup(
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

    api_key = body.llm_api_key
    if not api_key and cfg.llm_api_key_encrypted:
        api_key = decrypt(cfg.llm_api_key_encrypted)

    result = await test_provider_connection(body.provider, api_key, body.llm_api_base)
    return ConnectionTestResult(**result)
