import uuid

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    ModelsResponse,
    ProviderInfo,
)
from ios_app_agent.services.encryption import decrypt
from ios_app_agent.services.provider_service import list_models_for_provider, list_providers

router = APIRouter(prefix="/v1/apps/{app_id}/config", tags=["config"])


def encrypt_key(plain: str) -> str:
    f = Fernet(settings.encryption_key.encode())
    return f.encrypt(plain.encode()).decode()


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
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    cfg = await _get_or_create_config(db, app_id)

    updates = body.model_dump(exclude_unset=True)
    if "llm_api_key" in updates:
        llm_key = updates.pop("llm_api_key")
        if llm_key:
            cfg.llm_api_key_encrypted = encrypt_key(llm_key)
        else:
            cfg.llm_api_key_encrypted = None

    for field, value in updates.items():
        setattr(cfg, field, value)

    await db.commit()
    await db.refresh(cfg)
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
    provider_id = provider or cfg.llm_provider

    api_key = None
    if cfg.llm_api_key_encrypted:
        api_key = decrypt(cfg.llm_api_key_encrypted)

    models, is_dynamic = await list_models_for_provider(
        provider_id, api_key, cfg.llm_api_base
    )

    return ModelsResponse(provider=provider_id, models=models, is_dynamic=is_dynamic)
