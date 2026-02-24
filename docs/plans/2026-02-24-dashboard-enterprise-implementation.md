# Dashboard Enterprise Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement sidebar navigation, split config pages with section-level saves and test-connection, robust sessions viewer, full audit log, and hardened API client.

**Architecture:** Backend gets a new `audit_events` table written by service-layer hooks and exposed via a paginated endpoint; a new test-connection endpoint validates LLM credentials without saving. Frontend gains a left sidebar replacing pill nav, three isolated config pages with dirty-state tracking, improved sessions with AbortController + pagination + rich tool rendering, and an audit log page.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async + Pydantic v2 + Alembic (backend); React + TypeScript + Tailwind CSS + React Router v6 (frontend); uv (Python package runner); pytest + httpx (backend tests).

**Design doc:** `docs/plans/2026-02-24-dashboard-enterprise-redesign.md`

---

## Task 1: Harden the API client

**Files:**
- Modify: `dashboard/src/api/client.ts`

**Step 1: Replace the existing client with a hardened version**

```typescript
// dashboard/src/api/client.ts
const BASE = "";

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth:expired"));
    throw new ApiError(401, "Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText);
  }
  return res.json();
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1 | head -30
```

Expected: no TypeScript errors related to `client.ts`.

**Step 3: Update call sites that use `err instanceof Error ? err.message : "..."`**

Search for all occurrences:
```bash
grep -rn 'err instanceof Error' /Users/t0405/Developer/playbook_backend/dashboard/src/
```

In every `.catch` / `catch` block that has `err instanceof Error ? err.message : "Failed..."`, replace with:
```typescript
import { ApiError } from "../api/client";
// ...
} catch (err) {
  toast(err instanceof ApiError ? err.detail : "Operation failed", "error");
}
```

Apply to: `Apps.tsx`, `AppConfig.tsx` (will be deleted later — skip), `Functions.tsx`, `ApiKeys.tsx`, `Sessions.tsx`.

**Step 4: Add `auth:expired` listener to Layout**

In `dashboard/src/components/Layout.tsx`, inside the component body after the `useNavigate` call:

```typescript
useEffect(() => {
  function handleAuthExpired() {
    clearToken();
    navigate("/login");
  }
  window.addEventListener("auth:expired", handleAuthExpired);
  return () => window.removeEventListener("auth:expired", handleAuthExpired);
}, [navigate]);
```

Add import: `import { clearToken } from "../api/client";`
Remove existing `clearToken` call from the sign-out button (keep that one, it's separate).

**Step 5: Build to verify**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1 | tail -5
```

Expected: `✓ built in ...`

**Step 6: Commit**

```bash
git add dashboard/src/api/client.ts dashboard/src/components/Layout.tsx dashboard/src/pages/Functions.tsx dashboard/src/pages/ApiKeys.tsx dashboard/src/pages/Apps.tsx dashboard/src/pages/Sessions.tsx
git commit -m "feat: harden API client with ApiError, signal support, and auth:expired event"
```

---

## Task 2: Add `custom_base_url` to ProviderInfo schema

**Files:**
- Modify: `ios_app_agent/schemas/agent_config.py`
- Modify: `ios_app_agent/services/provider_service.py`

**Purpose:** Remove the `providerID === "nexos"` hardcode from the frontend. The backend declares which providers support a custom base URL.

**Step 1: Write the failing test**

Create `tests/test_provider_service.py`:
```python
from ios_app_agent.services.provider_service import list_providers


def test_providers_have_custom_base_url_flag():
    providers = list_providers()
    for p in providers:
        assert hasattr(p, "custom_base_url"), f"{p.id} missing custom_base_url"


def test_nexos_has_custom_base_url():
    providers = list_providers()
    nexos = next((p for p in providers if p.id == "nexos"), None)
    assert nexos is not None
    assert nexos.custom_base_url is True


def test_openai_no_custom_base_url():
    providers = list_providers()
    openai = next((p for p in providers if p.id == "openai"), None)
    assert openai is not None
    assert openai.custom_base_url is False
```

**Step 2: Run tests to verify failure**

```bash
cd /Users/t0405/Developer/playbook_backend && uv run pytest tests/test_provider_service.py -v
```

Expected: FAIL — `ProviderInfo` has no `custom_base_url` attribute.

**Step 3: Update `ProviderInfo` schema**

In `ios_app_agent/schemas/agent_config.py`, change `ProviderInfo`:
```python
class ProviderInfo(BaseModel):
    id: str
    name: str
    custom_base_url: bool = False
```

**Step 4: Update `PROVIDERS` list in provider_service.py**

In `ios_app_agent/services/provider_service.py`, change the `PROVIDERS` list:
```python
PROVIDERS: list[ProviderInfo] = [
    ProviderInfo(id="openai", name="OpenAI", custom_base_url=False),
    ProviderInfo(id="anthropic", name="Anthropic", custom_base_url=False),
    ProviderInfo(id="google", name="Google", custom_base_url=False),
    ProviderInfo(id="nexos", name="Nexos AI", custom_base_url=True),
]
```

**Step 5: Run tests to verify they pass**

```bash
uv run pytest tests/test_provider_service.py -v
```

Expected: 3 PASSED.

**Step 6: Commit**

```bash
git add ios_app_agent/schemas/agent_config.py ios_app_agent/services/provider_service.py tests/test_provider_service.py
git commit -m "feat: add custom_base_url flag to ProviderInfo schema"
```

---

## Task 3: Add AuditEvent model and Alembic migration

**Files:**
- Create: `ios_app_agent/models/audit_event.py`
- Modify: `ios_app_agent/models/__init__.py`
- Create: migration via alembic autogenerate

**Step 1: Create the model**

```python
# ios_app_agent/models/audit_event.py
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ios_app_agent.models.base import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    app_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("apps.id", ondelete="CASCADE"), nullable=False
    )
    actor_email: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    diff: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        Index("idx_audit_events_app_id_created", "app_id", "created_at"),
    )
```

**Step 2: Register model in `__init__.py`**

In `ios_app_agent/models/__init__.py`, add:
```python
from ios_app_agent.models.audit_event import AuditEvent  # noqa: F401
```

(Check existing imports in that file and add to the list.)

**Step 3: Generate migration**

```bash
cd /Users/t0405/Developer/playbook_backend && uv run alembic revision --autogenerate -m "add_audit_events"
```

Expected: creates a new file in `alembic/versions/`.

**Step 4: Inspect the migration**

```bash
ls alembic/versions/ | sort | tail -3
```

Open the newest file and verify it contains `op.create_table('audit_events', ...)` and the index. If autogenerate missed the index, add it manually in the migration's `upgrade()`:
```python
op.create_index('idx_audit_events_app_id_created', 'audit_events', ['app_id', 'created_at'])
```

**Step 5: Apply migration**

```bash
uv run alembic upgrade head
```

Expected: migration runs without error.

**Step 6: Commit**

```bash
git add ios_app_agent/models/audit_event.py ios_app_agent/models/__init__.py alembic/versions/
git commit -m "feat: add audit_events table"
```

---

## Task 4: Add AuditService

**Files:**
- Create: `ios_app_agent/services/audit_service.py`

**Step 1: Write the failing test**

Create `tests/test_audit_service.py`:
```python
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, call

from ios_app_agent.services.audit_service import AuditService
from ios_app_agent.models.audit_event import AuditEvent


@pytest.mark.asyncio
async def test_emit_event_creates_audit_event():
    db = AsyncMock()
    app_id = uuid.uuid4()

    await AuditService.emit(
        db=db,
        app_id=app_id,
        actor_email="dev@example.com",
        event_type="config.llm.updated",
        diff={"before": {"provider": "openai"}, "after": {"provider": "anthropic"}},
    )

    db.add.assert_called_once()
    event = db.add.call_args[0][0]
    assert isinstance(event, AuditEvent)
    assert event.app_id == app_id
    assert event.actor_email == "dev@example.com"
    assert event.event_type == "config.llm.updated"
    assert event.diff["before"]["provider"] == "openai"
    db.flush.assert_called_once()
```

**Step 2: Install pytest-asyncio if not present**

```bash
uv add --dev pytest-asyncio
```

Add to `pyproject.toml` (or `pytest.ini`):
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**Step 3: Run test to verify failure**

```bash
uv run pytest tests/test_audit_service.py -v
```

Expected: FAIL — `AuditService` module not found.

**Step 4: Implement AuditService**

```python
# ios_app_agent/services/audit_service.py
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.models.audit_event import AuditEvent


class AuditService:
    @staticmethod
    async def emit(
        db: AsyncSession,
        app_id: uuid.UUID,
        actor_email: str,
        event_type: str,
        entity_id: str | None = None,
        entity_name: str | None = None,
        diff: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> None:
        event = AuditEvent(
            app_id=app_id,
            actor_email=actor_email,
            event_type=event_type,
            entity_id=entity_id,
            entity_name=entity_name,
            diff=diff,
            ip_address=ip_address,
        )
        db.add(event)
        await db.flush()
```

**Step 5: Run tests to verify they pass**

```bash
uv run pytest tests/test_audit_service.py -v
```

Expected: PASSED.

**Step 6: Commit**

```bash
git add ios_app_agent/services/audit_service.py tests/test_audit_service.py
git commit -m "feat: add AuditService.emit"
```

---

## Task 5: Wire audit events into the config router

**Files:**
- Modify: `ios_app_agent/routers/config.py`

**Purpose:** After each successful config update, determine which field groups changed and emit the appropriate audit events.

**Step 1: Write the failing test**

Create `tests/test_config_audit.py`:
```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
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
    for k, v in {**defaults, **kwargs}.items():
        setattr(cfg, k, v)
    return cfg


def test_llm_fields_changed():
    old = make_cfg(llm_provider="openai", llm_model="gpt-4o")
    updates = {"llm_provider": "anthropic", "llm_model": "claude-sonnet-4-5"}
    events = _compute_config_audit_events(old, updates, api_key_rotated=False)
    assert any(e["type"] == "config.llm.updated" for e in events)


def test_prompt_changed():
    old = make_cfg(system_prompt="Old prompt")
    updates = {"system_prompt": "New prompt"}
    events = _compute_config_audit_events(old, updates, api_key_rotated=False)
    assert any(e["type"] == "config.prompt.updated" for e in events)


def test_limits_changed():
    old = make_cfg(temperature=0.7)
    updates = {"temperature": 1.0}
    events = _compute_config_audit_events(old, updates, api_key_rotated=False)
    assert any(e["type"] == "config.limits.updated" for e in events)


def test_no_change_no_events():
    old = make_cfg(llm_provider="openai")
    updates = {"llm_provider": "openai"}
    events = _compute_config_audit_events(old, updates, api_key_rotated=False)
    assert events == []


def test_api_key_rotated_emits_llm_event():
    old = make_cfg()
    updates = {}
    events = _compute_config_audit_events(old, updates, api_key_rotated=True)
    assert any(e["type"] == "config.llm.updated" for e in events)
```

**Step 2: Run tests to verify failure**

```bash
uv run pytest tests/test_config_audit.py -v
```

Expected: FAIL — `_compute_config_audit_events` not found.

**Step 3: Add helper and audit wiring to config.py**

At the top of `ios_app_agent/routers/config.py`, add:
```python
from fastapi import Request
from ios_app_agent.services.audit_service import AuditService
```

After the imports, add the helper function:
```python
_LLM_FIELDS = {"llm_provider", "llm_model", "llm_api_base"}
_PROMPT_FIELDS = {"system_prompt"}
_LIMITS_FIELDS = {"temperature", "max_tokens", "max_tool_rounds", "session_ttl_minutes", "max_context_messages"}


def _compute_config_audit_events(
    old_cfg,
    updates: dict,
    api_key_rotated: bool,
) -> list[dict]:
    events = []

    llm_before = {f: getattr(old_cfg, f) for f in _LLM_FIELDS}
    llm_after = {f: updates.get(f, getattr(old_cfg, f)) for f in _LLM_FIELDS}
    if llm_before != llm_after or api_key_rotated:
        diff = {"before": llm_before, "after": llm_after}
        if api_key_rotated:
            diff["api_key_rotated"] = True
        events.append({"type": "config.llm.updated", "diff": diff})

    prompt_before = {f: getattr(old_cfg, f) for f in _PROMPT_FIELDS}
    prompt_after = {f: updates.get(f, getattr(old_cfg, f)) for f in _PROMPT_FIELDS}
    if prompt_before != prompt_after:
        events.append({"type": "config.prompt.updated", "diff": {"before": prompt_before, "after": prompt_after}})

    limits_before = {f: getattr(old_cfg, f) for f in _LIMITS_FIELDS}
    limits_after = {f: updates.get(f, getattr(old_cfg, f)) for f in _LIMITS_FIELDS}
    if limits_before != limits_after:
        events.append({"type": "config.limits.updated", "diff": {"before": limits_before, "after": limits_after}})

    return events
```

Update the `update_config` route signature to accept `Request` and emit events:
```python
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

    ip = request.client.host if request.client else None
    for ev in audit_events:
        await AuditService.emit(
            db=db,
            app_id=app_id,
            actor_email=developer.email,
            event_type=ev["type"],
            diff=ev["diff"],
            ip_address=ip,
        )
    if audit_events:
        await db.commit()

    return config_to_out(cfg)
```

**Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_config_audit.py -v
```

Expected: 5 PASSED.

**Step 5: Commit**

```bash
git add ios_app_agent/routers/config.py tests/test_config_audit.py
git commit -m "feat: emit audit events on config updates"
```

---

## Task 6: Wire audit events into functions and api_keys routers

**Files:**
- Modify: `ios_app_agent/routers/functions.py`
- Modify: `ios_app_agent/routers/api_keys.py`

**Step 1: Read the full functions and api_keys routers**

```bash
cat /Users/t0405/Developer/playbook_backend/ios_app_agent/routers/functions.py
cat /Users/t0405/Developer/playbook_backend/ios_app_agent/routers/api_keys.py
```

**Step 2: Add audit emit to functions dashboard router**

In `ios_app_agent/routers/functions.py`, add import at the top:
```python
from fastapi import Request
from ios_app_agent.services.audit_service import AuditService
```

In the `update_function` (PATCH) endpoint in `dashboard_router`, after the successful commit, add:
```python
# determine event type
if "is_active" in updates:
    event_type = "function.activated" if updated.is_active else "function.deactivated"
    await AuditService.emit(
        db=db, app_id=app_id, actor_email=developer.email,
        event_type=event_type, entity_id=str(fn_id), entity_name=fn.name,
        ip_address=request.client.host if request.client else None,
    )
if "description_override" in updates:
    await AuditService.emit(
        db=db, app_id=app_id, actor_email=developer.email,
        event_type="function.override_set", entity_id=str(fn_id), entity_name=fn.name,
        ip_address=request.client.host if request.client else None,
    )
await db.commit()
```

Also add `request: Request` parameter to the `update_function` endpoint signature.

**Step 3: Add audit emit to api_keys router**

In `ios_app_agent/routers/api_keys.py`, add imports:
```python
from fastapi import Request
from ios_app_agent.services.audit_service import AuditService
```

After creating an API key (POST), emit:
```python
await AuditService.emit(
    db=db, app_id=app_id, actor_email=developer.email,
    event_type="apikey.created",
    entity_id=str(new_key.id), entity_name=body.label or new_key.key_prefix,
    ip_address=request.client.host if request.client else None,
)
await db.commit()
```

After revoking (DELETE), emit:
```python
await AuditService.emit(
    db=db, app_id=app_id, actor_email=developer.email,
    event_type="apikey.revoked",
    entity_id=str(key_id), entity_name=key.label or key.key_prefix,
    ip_address=request.client.host if request.client else None,
)
await db.commit()
```

Add `request: Request` to both endpoint signatures.

**Step 4: Run the backend to verify no startup errors**

```bash
cd /Users/t0405/Developer/playbook_backend && uv run python main.py &
sleep 2 && curl -s http://localhost:8000/health && kill %1
```

Expected: `{"status":"ok"}`

**Step 5: Commit**

```bash
git add ios_app_agent/routers/functions.py ios_app_agent/routers/api_keys.py
git commit -m "feat: emit audit events for function and api key changes"
```

---

## Task 7: Add audit events endpoint + mount router

**Files:**
- Create: `ios_app_agent/routers/audit.py`
- Create: `ios_app_agent/schemas/audit.py`
- Modify: `ios_app_agent/main.py`

**Step 1: Write the failing test**

Create `tests/test_audit_router.py`:
```python
import pytest
import uuid
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


def test_audit_router_is_mounted():
    """Verify the audit events route exists."""
    from ios_app_agent.main import app
    routes = [r.path for r in app.routes]
    assert any("/audit-events" in r for r in routes)
```

**Step 2: Run test to verify failure**

```bash
uv run pytest tests/test_audit_router.py -v
```

Expected: FAIL.

**Step 3: Create audit schema**

```python
# ios_app_agent/schemas/audit.py
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditEventOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    actor_email: str
    event_type: str
    entity_id: str | None
    entity_name: str | None
    diff: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditEventsPage(BaseModel):
    events: list[AuditEventOut]
    next_cursor: str | None
```

**Step 4: Create audit router**

```python
# ios_app_agent/routers/audit.py
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer, require_app_ownership
from ios_app_agent.models.app import App
from ios_app_agent.models.audit_event import AuditEvent
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.schemas.audit import AuditEventOut, AuditEventsPage

router = APIRouter(prefix="/v1/apps/{app_id}/audit-events", tags=["audit"])


@router.get("", response_model=AuditEventsPage)
async def list_audit_events(
    app_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    q = select(AuditEvent).where(AuditEvent.app_id == app_id)

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor")
        q = q.where(AuditEvent.created_at < cursor_dt)

    if event_type:
        q = q.where(AuditEvent.event_type == event_type)

    q = q.order_by(AuditEvent.created_at.desc()).limit(limit + 1)
    result = await db.execute(q)
    rows = result.scalars().all()

    has_more = len(rows) > limit
    events = rows[:limit]
    next_cursor = events[-1].created_at.isoformat() if has_more and events else None

    return AuditEventsPage(
        events=[AuditEventOut.model_validate(e) for e in events],
        next_cursor=next_cursor,
    )
```

**Step 5: Mount router in main.py**

In `ios_app_agent/main.py`, add:
```python
from ios_app_agent.routers import audit
```

And below `app.include_router(config.router)`:
```python
app.include_router(audit.router)
```

**Step 6: Run test to verify it passes**

```bash
uv run pytest tests/test_audit_router.py -v
```

Expected: PASSED.

**Step 7: Commit**

```bash
git add ios_app_agent/routers/audit.py ios_app_agent/schemas/audit.py ios_app_agent/main.py tests/test_audit_router.py
git commit -m "feat: add audit events endpoint GET /v1/apps/:id/audit-events"
```

---

## Task 8: Add test-connection endpoint

**Files:**
- Modify: `ios_app_agent/services/provider_service.py`
- Modify: `ios_app_agent/routers/config.py`
- Modify: `ios_app_agent/schemas/agent_config.py`

**Step 1: Write the failing test**

Create `tests/test_connection_test.py`:
```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from ios_app_agent.services.provider_service import test_provider_connection


@pytest.mark.asyncio
async def test_connection_returns_ok_true_on_success():
    # patch list_models_for_provider to return models with no error
    with patch(
        "ios_app_agent.services.provider_service.list_models_for_provider",
        new=AsyncMock(return_value=(
            [MagicMock(id="gpt-4o", name="GPT-4o")],
            True,
            None,
        )),
    ):
        result = await test_provider_connection("openai", "sk-test", None)
    assert result["ok"] is True
    assert result["error"] is None
    assert result["latency_ms"] >= 0


@pytest.mark.asyncio
async def test_connection_returns_ok_false_on_error():
    with patch(
        "ios_app_agent.services.provider_service.list_models_for_provider",
        new=AsyncMock(return_value=([], False, "Invalid API key")),
    ):
        result = await test_provider_connection("openai", "sk-bad", None)
    assert result["ok"] is False
    assert result["error"] == "Invalid API key"
```

**Step 2: Run tests to verify failure**

```bash
uv run pytest tests/test_connection_test.py -v
```

Expected: FAIL — `test_provider_connection` not found.

**Step 3: Add `test_provider_connection` to provider_service.py**

In `ios_app_agent/services/provider_service.py`, add at the bottom:
```python
import time


async def test_provider_connection(
    provider: str,
    api_key: str | None,
    api_base: str | None,
) -> dict:
    start = time.monotonic()
    try:
        models, _, error = await list_models_for_provider(provider, api_key, api_base)
        elapsed_ms = int((time.monotonic() - start) * 1000)
        if error:
            return {"ok": False, "latency_ms": None, "error": error}
        if not models:
            return {"ok": False, "latency_ms": None, "error": "No models returned — check your API key"}
        return {"ok": True, "latency_ms": elapsed_ms, "error": None}
    except Exception as exc:
        return {"ok": False, "latency_ms": None, "error": str(exc)}
```

**Step 4: Add schema for test response**

In `ios_app_agent/schemas/agent_config.py`, add:
```python
class ConnectionTestRequest(BaseModel):
    provider: str
    model: str | None = None
    llm_api_key: str | None = None   # plain text; if None, uses stored key
    llm_api_base: str | None = None


class ConnectionTestResult(BaseModel):
    ok: bool
    latency_ms: int | None
    error: str | None
```

**Step 5: Add endpoint to config.py**

In `ios_app_agent/routers/config.py`, add imports:
```python
from ios_app_agent.schemas.agent_config import ConnectionTestRequest, ConnectionTestResult
from ios_app_agent.services.provider_service import test_provider_connection
from ios_app_agent.services.encryption import decrypt
```

Add endpoint after the `/models` route:
```python
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

    # Use body key if provided, else fall back to stored key
    api_key = body.llm_api_key
    if not api_key and cfg.llm_api_key_encrypted:
        api_key = decrypt(cfg.llm_api_key_encrypted)

    result = await test_provider_connection(body.provider, api_key, body.llm_api_base)
    return ConnectionTestResult(**result)
```

**Step 6: Run tests to verify they pass**

```bash
uv run pytest tests/test_connection_test.py -v
```

Expected: 2 PASSED.

**Step 7: Commit**

```bash
git add ios_app_agent/services/provider_service.py ios_app_agent/routers/config.py ios_app_agent/schemas/agent_config.py tests/test_connection_test.py
git commit -m "feat: add POST /v1/apps/:id/config/test for LLM connection testing"
```

---

## Task 9: AppSidebar component + Layout refactor

**Files:**
- Create: `dashboard/src/components/AppSidebar.tsx`
- Create: `dashboard/src/context/DirtyStateContext.tsx`
- Modify: `dashboard/src/components/Layout.tsx`

**Step 1: Create DirtyStateContext**

```typescript
// dashboard/src/context/DirtyStateContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";

interface DirtyStateContextValue {
  dirtyPages: Set<string>;
  markDirty: (page: string) => void;
  markClean: (page: string) => void;
}

const DirtyStateContext = createContext<DirtyStateContextValue>({
  dirtyPages: new Set(),
  markDirty: () => {},
  markClean: () => {},
});

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const [dirtyPages, setDirtyPages] = useState<Set<string>>(new Set());

  function markDirty(page: string) {
    setDirtyPages((prev) => new Set([...prev, page]));
  }

  function markClean(page: string) {
    setDirtyPages((prev) => {
      const next = new Set(prev);
      next.delete(page);
      return next;
    });
  }

  return (
    <DirtyStateContext.Provider value={{ dirtyPages, markDirty, markClean }}>
      {children}
    </DirtyStateContext.Provider>
  );
}

export function useDirtyState() {
  return useContext(DirtyStateContext);
}
```

**Step 2: Create AppSidebar**

```typescript
// dashboard/src/components/AppSidebar.tsx
import { NavLink, Link, useParams } from "react-router-dom";
import { useDirtyState } from "../context/DirtyStateContext";

const NAV_ITEMS = [
  { label: "Agent", slug: "agent", group: "config" },
  { label: "LLM", slug: "llm", group: "config" },
  { label: "Limits", slug: "limits", group: "config" },
  { label: "Functions", slug: "functions", group: "tools" },
  { label: "Sessions", slug: "sessions", group: "tools" },
  { label: "API Keys", slug: "api-keys", group: "tools" },
  { label: "Playbooks", slug: "playbooks", group: "tools" },
  { label: "Audit Log", slug: "audit", group: "audit" },
];

export default function AppSidebar() {
  const { appId } = useParams<{ appId: string }>();
  const { dirtyPages } = useDirtyState();

  if (!appId) return null;

  return (
    <nav className="w-48 flex-shrink-0 flex flex-col gap-1 pt-2">
      <Link
        to="/apps"
        className="flex items-center gap-1.5 text-xs text-subtle hover:text-body transition-colors mb-3 px-2"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Apps
      </Link>

      {NAV_ITEMS.map((item) => {
        const isDirty = dirtyPages.has(item.slug);
        return (
          <NavLink
            key={item.slug}
            to={`/apps/${appId}/${item.slug}`}
            className={({ isActive }) =>
              `flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-accent-subtle text-accent font-medium"
                  : "text-subtle hover:text-body hover:bg-surface-2"
              }`
            }
          >
            {item.label}
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" title="Unsaved changes" />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
```

**Step 3: Refactor Layout to include sidebar**

Replace `dashboard/src/components/Layout.tsx` with:

```typescript
import { useEffect } from "react";
import { Link, Outlet, useNavigate, useMatch } from "react-router-dom";
import { clearToken } from "../api/client";
import AppSidebar from "./AppSidebar";
import { DirtyStateProvider } from "../context/DirtyStateContext";

function decodeEmail(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || payload.email || "";
  } catch {
    return "";
  }
}

export default function Layout() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const isAppRoute = useMatch("/apps/:appId/*");

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  useEffect(() => {
    function handleAuthExpired() {
      clearToken();
      navigate("/login");
    }
    window.addEventListener("auth:expired", handleAuthExpired);
    return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, [navigate]);

  if (!token) return null;

  const email = decodeEmail(token);

  return (
    <DirtyStateProvider>
      <div className="min-h-screen bg-canvas">
        {/* Fixed top nav */}
        <nav
          className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 bg-surface/80 backdrop-blur-md border-b border-border"
          style={{ height: "var(--nav-height)" }}
        >
          <Link to="/apps" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-bold text-xs leading-none">IA</span>
            </div>
            <span className="font-display font-semibold text-strong text-sm tracking-tight">Playbook</span>
          </Link>
          <div className="flex items-center gap-4">
            {email && <span className="text-xs text-subtle hidden sm:block font-mono">{email}</span>}
            <button
              onClick={() => { clearToken(); navigate("/login"); }}
              className="text-xs text-subtle hover:text-body transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-border-2"
            >
              Sign out
            </button>
          </div>
        </nav>

        {/* Page content */}
        <div
          className="max-w-5xl mx-auto px-4 md:px-6 flex gap-8"
          style={{ paddingTop: "calc(var(--nav-height) + 2rem)", paddingBottom: "2rem" }}
        >
          {isAppRoute && <AppSidebar />}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </DirtyStateProvider>
  );
}
```

**Step 4: Build to verify**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors.

**Step 5: Commit**

```bash
git add dashboard/src/components/AppSidebar.tsx dashboard/src/context/DirtyStateContext.tsx dashboard/src/components/Layout.tsx
git commit -m "feat: add AppSidebar with dirty-state dots and refactor Layout"
```

---

## Task 10: AgentPrompt page

**Files:**
- Create: `dashboard/src/pages/AgentPrompt.tsx`

**Step 1: Implement page**

```typescript
// dashboard/src/pages/AgentPrompt.tsx
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Button, PageSpinner, Textarea, useToast } from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";

interface Config {
  system_prompt: string;
}

export default function AgentPrompt() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();

  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = saved !== null && draft !== saved;

  useEffect(() => {
    api<Config>(`/v1/apps/${appId}/config`).then((c) => {
      setSaved(c.system_prompt);
      setDraft(c.system_prompt);
    });
  }, [appId]);

  useEffect(() => {
    if (isDirty) markDirty("agent");
    else markClean("agent");
    return () => markClean("agent");
  }, [isDirty, markDirty, markClean]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api<Config>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify({ system_prompt: draft }),
      });
      setSaved(updated.system_prompt);
      setDraft(updated.system_prompt);
      toast("Agent prompt saved", "success");
    } catch (err) {
      toast(err instanceof ApiError ? err.detail : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (saved === null) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-strong">Agent Prompt</h1>
        <p className="text-sm text-subtle mt-1">System prompt sent to the LLM at the start of every session.</p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6">
        <Textarea
          label="System Prompt"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          placeholder="You are a helpful iOS app assistant..."
        />
        <p className="text-xs text-muted mt-1.5 text-right">{draft.length} characters</p>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="primary" size="md" loading={isSaving} disabled={!isDirty}>
            Save Prompt
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Build to verify**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add dashboard/src/pages/AgentPrompt.tsx
git commit -m "feat: add AgentPrompt config page with dirty-state tracking"
```

---

## Task 11: LlmConfig page

**Files:**
- Create: `dashboard/src/pages/LlmConfig.tsx`

**Step 1: Implement page**

```typescript
// dashboard/src/pages/LlmConfig.tsx
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Badge, Button, Input, PageSpinner, Select, Spinner, useToast } from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";

interface Config {
  llm_provider: string;
  llm_model: string;
  has_llm_api_key: boolean;
  llm_api_base: string | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  custom_base_url: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
}

interface ModelsResponse {
  provider: string;
  models: ModelInfo[];
  is_dynamic: boolean;
  error?: string | null;
}

interface TestResult {
  ok: boolean;
  latency_ms: number | null;
  error: string | null;
}

export default function LlmConfig() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();

  const [saved, setSaved] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [isDynamic, setIsDynamic] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const isDirty =
    saved !== null &&
    draft !== null &&
    (draft.llm_provider !== saved.llm_provider ||
      draft.llm_model !== saved.llm_model ||
      draft.llm_api_base !== saved.llm_api_base ||
      apiKey !== "");

  useEffect(() => {
    Promise.all([
      api<Config>(`/v1/apps/${appId}/config`),
      api<ProviderInfo[]>(`/v1/apps/${appId}/config/providers`),
    ]).then(([cfg, pvds]) => {
      setSaved(cfg);
      setDraft(cfg);
      setProviders(pvds);
    });
  }, [appId]);

  useEffect(() => {
    if (!draft?.has_llm_api_key && !apiKey) {
      setModels([]);
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    api<ModelsResponse>(`/v1/apps/${appId}/config/models?provider=${draft?.llm_provider}`)
      .then((res) => {
        setModels(res.models);
        setIsDynamic(res.is_dynamic);
        setModelsError(res.error ?? null);
        if (res.models.length > 0 && draft && !res.models.some((m) => m.id === draft.llm_model)) {
          setDraft((prev) => prev && { ...prev, llm_model: res.models[0].id });
        }
      })
      .finally(() => setModelsLoading(false));
  }, [appId, draft?.llm_provider, draft?.has_llm_api_key, apiKey]);

  useEffect(() => {
    if (isDirty) markDirty("llm");
    else markClean("llm");
    return () => markClean("llm");
  }, [isDirty, markDirty, markClean]);

  const currentProvider = providers.find((p) => p.id === draft?.llm_provider);
  const showApiBase = currentProvider?.custom_base_url ?? false;

  function handleProviderChange(providerId: string) {
    if (!draft) return;
    const provider = providers.find((p) => p.id === providerId);
    setDraft({
      ...draft,
      llm_provider: providerId,
      llm_api_base: provider?.custom_base_url ? (draft.llm_api_base || "") : null,
    });
    setTestResult(null);
  }

  async function handleTest() {
    if (!draft) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await api<TestResult>(`/v1/apps/${appId}/config/test`, {
        method: "POST",
        body: JSON.stringify({
          provider: draft.llm_provider,
          model: draft.llm_model,
          llm_api_key: apiKey || null,
          llm_api_base: draft.llm_api_base || null,
        }),
      });
      setTestResult(result);
    } catch (err) {
      toast(err instanceof ApiError ? err.detail : "Test failed", "error");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        llm_provider: draft.llm_provider,
        llm_model: draft.llm_model,
        llm_api_base: draft.llm_api_base,
      };
      if (apiKey) body.llm_api_key = apiKey;
      const updated = await api<Config>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSaved(updated);
      setDraft(updated);
      setApiKey("");
      setTestResult(null);
      toast("LLM configuration saved", "success");
    } catch (err) {
      toast(err instanceof ApiError ? err.detail : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (!draft || !saved) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-strong">LLM Provider</h1>
        <p className="text-sm text-subtle mt-1">Configure the AI model and credentials for this app's agent.</p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-5">
        {/* Provider + Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Provider"
            value={draft.llm_provider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-subtle">Model</label>
              {modelsLoading && <Spinner size="sm" />}
              {!modelsLoading && models.length > 0 && (
                <Badge variant={isDynamic ? "live" : "default"}>{isDynamic ? "live" : "default list"}</Badge>
              )}
            </div>
            {modelsLoading ? (
              <div className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-muted">Loading models...</div>
            ) : models.length > 0 ? (
              <select
                value={draft.llm_model}
                onChange={(e) => setDraft({ ...draft, llm_model: e.target.value })}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors"
              >
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            ) : (
              <div className="space-y-1">
                <input
                  value={draft.llm_model}
                  onChange={(e) => setDraft({ ...draft, llm_model: e.target.value })}
                  placeholder="Enter model ID"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                />
                {modelsError && <p className="text-xs text-danger">Failed to fetch models: {modelsError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* API Key */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-xs font-medium text-subtle">LLM API Key</label>
            {saved.has_llm_api_key && <Badge variant="active" dot>Set</Badge>}
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={saved.has_llm_api_key ? "Enter new key to rotate" : "Enter API key"}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
          />
        </div>

        {/* API Base (data-driven) */}
        {showApiBase && (
          <Input
            label="API Base URL"
            value={draft.llm_api_base || ""}
            onChange={(e) => setDraft({ ...draft, llm_api_base: e.target.value || null })}
            placeholder="https://api.example.com/v1"
            mono
          />
        )}

        {/* Test connection result */}
        {testResult && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
            testResult.ok
              ? "bg-success-subtle border-success-dim text-success"
              : "bg-danger-subtle border-danger-dim text-danger"
          }`}>
            {testResult.ok ? (
              <>
                <span className="w-2 h-2 rounded-full bg-success" />
                Connected · {testResult.latency_ms}ms
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-danger" />
                {testResult.error || "Connection failed"}
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button type="button" variant="outline" size="md" onClick={handleTest} loading={isTesting}>
            Test Connection
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isSaving} disabled={!isDirty}>
            Save LLM Config
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Build to verify**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add dashboard/src/pages/LlmConfig.tsx
git commit -m "feat: add LlmConfig page with test connection and dirty-state tracking"
```

---

## Task 12: LimitsConfig page

**Files:**
- Create: `dashboard/src/pages/LimitsConfig.tsx`

**Step 1: Implement page**

```typescript
// dashboard/src/pages/LimitsConfig.tsx
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Button, Input, PageSpinner, useToast } from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";

interface Limits {
  temperature: number;
  max_tokens: number;
  max_tool_rounds: number;
  session_ttl_minutes: number;
  max_context_messages: number;
}

export default function LimitsConfig() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();

  const [saved, setSaved] = useState<Limits | null>(null);
  const [draft, setDraft] = useState<Limits | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    saved !== null &&
    draft !== null &&
    JSON.stringify(saved) !== JSON.stringify(draft);

  useEffect(() => {
    api<Limits>(`/v1/apps/${appId}/config`).then((c) => {
      const limits: Limits = {
        temperature: c.temperature,
        max_tokens: c.max_tokens,
        max_tool_rounds: c.max_tool_rounds,
        session_ttl_minutes: c.session_ttl_minutes,
        max_context_messages: c.max_context_messages,
      };
      setSaved(limits);
      setDraft(limits);
    });
  }, [appId]);

  useEffect(() => {
    if (isDirty) markDirty("limits");
    else markClean("limits");
    return () => markClean("limits");
  }, [isDirty, markDirty, markClean]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    try {
      const updated = await api<Limits>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      const limits: Limits = {
        temperature: updated.temperature,
        max_tokens: updated.max_tokens,
        max_tool_rounds: updated.max_tool_rounds,
        session_ttl_minutes: updated.session_ttl_minutes,
        max_context_messages: updated.max_context_messages,
      };
      setSaved(limits);
      setDraft(limits);
      toast("Limits saved", "success");
    } catch (err) {
      toast(err instanceof ApiError ? err.detail : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function set(field: keyof Limits, value: number) {
    setDraft((prev) => prev && { ...prev, [field]: value });
  }

  if (!draft || !saved) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-strong">Runtime Limits</h1>
        <p className="text-sm text-subtle mt-1">Control sampling parameters and session constraints.</p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-6">
        {/* Temperature */}
        <div>
          <label className="text-xs font-medium text-subtle block mb-1.5">
            Temperature
            <span className="ml-2 font-mono text-body">{draft.temperature.toFixed(1)}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={draft.temperature}
              onChange={(e) => set("temperature", parseFloat(e.target.value))}
              className="flex-1 accent-accent"
            />
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={draft.temperature}
              onChange={(e) => set("temperature", parseFloat(e.target.value))}
              className="w-16 bg-surface border border-border rounded-lg px-2 py-1 text-sm text-body text-center focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Max Tokens"
            type="number"
            value={draft.max_tokens}
            onChange={(e) => set("max_tokens", parseInt(e.target.value))}
          />
          <Input
            label="Max Tool Rounds"
            type="number"
            value={draft.max_tool_rounds}
            onChange={(e) => set("max_tool_rounds", parseInt(e.target.value))}
          />
          <Input
            label="Session TTL (minutes)"
            type="number"
            value={draft.session_ttl_minutes}
            onChange={(e) => set("session_ttl_minutes", parseInt(e.target.value))}
          />
          <Input
            label="Max Context Messages"
            type="number"
            value={draft.max_context_messages}
            onChange={(e) => set("max_context_messages", parseInt(e.target.value))}
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button type="submit" variant="primary" size="md" loading={isSaving} disabled={!isDirty}>
            Save Limits
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Build to verify**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add dashboard/src/pages/LimitsConfig.tsx
git commit -m "feat: add LimitsConfig page with temperature slider and dirty-state tracking"
```

---

## Task 13: Sessions page improvements

**Files:**
- Modify: `dashboard/src/pages/Sessions.tsx`

**Step 1: Replace Sessions.tsx with improved version**

```typescript
// dashboard/src/pages/Sessions.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { AppNav, Badge, Button, PageSpinner } from "../components/ui";

interface Session {
  id: string;
  device_id: string | null;
  status: string;
  last_activity_at: string;
  created_at: string;
  client_context?: Record<string, string | null>;
}

interface Message {
  id: string;
  sequence_number: number;
  role: string;
  content: string | null;
  tool_calls: Array<Record<string, unknown>> | Record<string, unknown> | null;
  tool_call_id: string | null;
  created_at: string;
}

function statusVariant(status: string): "active" | "expired" | "closed" | "default" {
  if (status === "active") return "active";
  if (status === "expired") return "expired";
  if (status === "closed") return "closed";
  return "default";
}

const PAGE_SIZE = 25;

function ToolCallCard({ calls }: { calls: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const arr = Array.isArray(calls) ? calls : [calls];
  return (
    <div className="border border-border rounded-lg overflow-hidden text-xs font-mono">
      {arr.map((call: Record<string, unknown>, i: number) => {
        const name = (call?.function as Record<string, unknown>)?.name as string ?? "tool_call";
        const args = (call?.function as Record<string, unknown>)?.arguments;
        return (
          <div key={i} className="px-3 py-2 bg-canvas border-b border-border last:border-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-accent font-semibold">→ {name}</span>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted hover:text-body transition-colors"
              >
                {expanded ? "collapse" : "expand"}
              </button>
            </div>
            {expanded && args && (
              <pre className="text-dim overflow-auto max-h-40 mt-1">
                {typeof args === "string" ? args : JSON.stringify(args, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Sessions() {
  const { appId } = useParams<{ appId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial sessions
  useEffect(() => {
    setIsLoading(true);
    api<Session[]>(`/v1/apps/${appId}/sessions?limit=${PAGE_SIZE + 1}`)
      .then((data) => {
        setHasMore(data.length > PAGE_SIZE);
        setSessions(data.slice(0, PAGE_SIZE));
      })
      .finally(() => setIsLoading(false));
  }, [appId]);

  // Load more sessions
  async function loadMore() {
    if (!sessions.length) return;
    setIsLoadingMore(true);
    const last = sessions[sessions.length - 1];
    try {
      const data = await api<Session[]>(
        `/v1/apps/${appId}/sessions?limit=${PAGE_SIZE + 1}&before=${last.created_at}`
      );
      setHasMore(data.length > PAGE_SIZE);
      setSessions((prev) => [...prev, ...data.slice(0, PAGE_SIZE)]);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Load messages for selected session
  const loadMessages = useCallback(
    async (sessionId: string) => {
      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSelectedId(sessionId);
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(true);

      // Clear active session polling
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      try {
        const msgs = await api<Message[]>(
          `/v1/apps/${appId}/sessions/${sessionId}/messages`,
          { signal: controller.signal }
        );
        setMessages(msgs);

        // Poll for active sessions
        const session = sessions.find((s) => s.id === sessionId);
        if (session?.status === "active") {
          pollRef.current = setInterval(async () => {
            try {
              const updated = await api<Message[]>(
                `/v1/apps/${appId}/sessions/${sessionId}/messages`
              );
              setMessages(updated);
            } catch {
              // ignore poll errors
            }
          }, 10000);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessagesError(err instanceof ApiError ? err.detail : "Failed to load messages");
      } finally {
        setMessagesLoading(false);
      }
    },
    [appId, sessions]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const selectedSession = sessions.find((s) => s.id === selectedId);

  const filteredSessions = sessions.filter((s) => {
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesSearch =
      !search ||
      s.id.startsWith(search) ||
      (s.device_id && s.device_id.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-strong">Chat Sessions</h1>
          <p className="text-sm text-subtle mt-1">View conversation history from your iOS app users.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by session ID or device ID..."
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-body focus:outline-none focus:border-accent placeholder:text-muted"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-body focus:outline-none focus:border-accent"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Session list */}
        <div className="col-span-1 space-y-2">
          {filteredSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadMessages(s.id)}
              className={`w-full text-left bg-surface border rounded-xl p-3 text-sm transition-all hover:border-border-2 ${
                selectedId === s.id ? "border-accent/40 bg-accent-subtle" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs text-dim">{s.id.slice(0, 8)}...</span>
                <Badge variant={statusVariant(s.status)} dot>
                  {s.status}
                </Badge>
              </div>
              {s.device_id && (
                <p className="text-xs text-subtle truncate mb-1">{s.device_id}</p>
              )}
              <p className="text-xs text-muted">
                {new Date(s.last_activity_at).toLocaleString()}
              </p>
            </button>
          ))}

          {filteredSessions.length === 0 && (
            <p className="text-subtle text-sm text-center py-8">No sessions match your filters.</p>
          )}

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMore}
              loading={isLoadingMore}
              className="w-full"
            >
              Load more
            </Button>
          )}
        </div>

        {/* Message pane */}
        <div className="col-span-2 bg-surface border border-border rounded-xl flex flex-col min-h-[500px] overflow-hidden">
          {selectedSession ? (
            <>
              {/* Pane header with metadata */}
              <div className="px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-dim">{selectedSession.id}</span>
                  <Badge variant={statusVariant(selectedSession.status)} dot>
                    {selectedSession.status}
                  </Badge>
                </div>
                {selectedSession.client_context && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedSession.client_context)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <span key={k} className="text-xs text-muted font-mono">
                          {k}: {v}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  </div>
                ) : messagesError ? (
                  <div className="text-center py-8">
                    <p className="text-danger text-sm mb-2">{messagesError}</p>
                    <Button variant="outline" size="sm" onClick={() => loadMessages(selectedSession.id)}>
                      Retry
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-dim text-center text-sm py-8">No messages in this session.</p>
                ) : (
                  messages.map((m) => {
                    const isUser = m.role === "user";
                    const isTool = m.role === "tool";

                    return (
                      <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            isUser
                              ? "bg-accent-subtle border border-accent-dim text-body"
                              : isTool
                                ? "bg-canvas border border-border text-dim w-full max-w-full"
                                : "bg-surface-2 border border-border text-body"
                          }`}
                        >
                          <p
                            className={`text-[10px] uppercase tracking-widest mb-1.5 ${
                              isUser ? "text-accent" : isTool ? "text-warning" : "text-subtle"
                            }`}
                          >
                            {m.role}
                          </p>
                          {m.content && (
                            <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                          )}
                          {m.tool_calls && <ToolCallCard calls={m.tool_calls} />}
                          {m.tool_call_id && (
                            <p className="text-xs text-muted mt-1 font-mono">call_id: {m.tool_call_id}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-subtle text-sm">
              Select a session to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Build to verify**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add dashboard/src/pages/Sessions.tsx
git commit -m "feat: sessions page — pagination, AbortController, error state, metadata header, tool call cards"
```

---

## Task 14: AuditLog page

**Files:**
- Create: `dashboard/src/pages/AuditLog.tsx`

**Step 1: Implement page**

```typescript
// dashboard/src/pages/AuditLog.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Button, PageSpinner } from "../components/ui";

interface AuditEvent {
  id: string;
  actor_email: string;
  event_type: string;
  entity_id: string | null;
  entity_name: string | null;
  diff: { before: Record<string, unknown>; after: Record<string, unknown>; api_key_rotated?: boolean } | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditPage {
  events: AuditEvent[];
  next_cursor: string | null;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  "config.llm.updated": "LLM config updated",
  "config.prompt.updated": "Prompt updated",
  "config.limits.updated": "Limits updated",
  "apikey.created": "API key created",
  "apikey.revoked": "API key revoked",
  "function.activated": "Function activated",
  "function.deactivated": "Function deactivated",
  "function.override_set": "Function override set",
};

function groupByDay(events: AuditEvent[]): [string, AuditEvent[]][] {
  const groups: Record<string, AuditEvent[]> = {};
  for (const e of events) {
    const day = new Date(e.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }
  return Object.entries(groups);
}

function DiffView({ diff }: { diff: NonNullable<AuditEvent["diff"]> }) {
  const [expanded, setExpanded] = useState(false);
  const changes: string[] = [];
  if (diff.api_key_rotated) changes.push("API key rotated");
  for (const key of Object.keys({ ...diff.before, ...diff.after })) {
    if (key === "api_key_rotated") continue;
    const before = diff.before?.[key];
    const after = diff.after?.[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push(`${key}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
  }

  if (changes.length === 0) return null;

  return (
    <div className="mt-1">
      {expanded ? (
        <div className="text-xs text-muted font-mono space-y-0.5 mt-1">
          {changes.map((c, i) => <div key={i}>{c}</div>)}
          <button onClick={() => setExpanded(false)} className="text-accent hover:text-accent-hover mt-1">
            collapse
          </button>
        </div>
      ) : (
        <div className="text-xs text-muted">
          {changes.slice(0, 2).join(" · ")}
          {changes.length > 2 && " · "}
          <button onClick={() => setExpanded(true)} className="text-accent hover:text-accent-hover">
            {changes.length > 2 ? `+${changes.length - 2} more` : "expand diff"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AuditLog() {
  const { appId } = useParams<{ appId: string }>();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  function buildUrl(cursor?: string) {
    const params = new URLSearchParams({ limit: "50" });
    if (typeFilter !== "all") params.set("event_type", typeFilter);
    if (cursor) params.set("cursor", cursor);
    return `/v1/apps/${appId}/audit-events?${params}`;
  }

  useEffect(() => {
    setIsLoading(true);
    setEvents([]);
    setNextCursor(null);
    api<AuditPage>(buildUrl())
      .then((data) => {
        setEvents(data.events);
        setNextCursor(data.next_cursor);
      })
      .finally(() => setIsLoading(false));
  }, [appId, typeFilter]);

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const data = await api<AuditPage>(buildUrl(nextCursor));
      setEvents((prev) => [...prev, ...data.events]);
      setNextCursor(data.next_cursor);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["timestamp", "actor", "event_type", "entity_name", "ip_address"].join(","),
      ...events.map((e) =>
        [e.created_at, e.actor_email, e.event_type, e.entity_name || "", e.ip_address || ""].join(",")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${appId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <PageSpinner />;

  const grouped = groupByDay(events);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-strong">Audit Log</h1>
          <p className="text-sm text-subtle mt-1">All configuration and key changes for this app.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-body focus:outline-none focus:border-accent"
          >
            <option value="all">All events</option>
            <option value="config.llm.updated">LLM config</option>
            <option value="config.prompt.updated">Prompt</option>
            <option value="config.limits.updated">Limits</option>
            <option value="apikey.created">API key created</option>
            <option value="apikey.revoked">API key revoked</option>
            <option value="function.activated">Function activated</option>
            <option value="function.deactivated">Function deactivated</option>
          </select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-subtle">
          <p className="text-sm">No audit events yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{day}</p>
              <div className="space-y-1">
                {dayEvents.map((e) => (
                  <div key={e.id} className="flex gap-4 py-2.5 border-b border-border last:border-0">
                    <span className="text-xs text-muted font-mono flex-shrink-0 w-12">
                      {new Date(e.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-body">
                          {EVENT_TYPE_LABELS[e.event_type] ?? e.event_type}
                        </span>
                        {e.entity_name && (
                          <span className="text-xs font-mono text-dim">{e.entity_name}</span>
                        )}
                        <span className="text-xs text-muted">{e.actor_email}</span>
                      </div>
                      {e.diff && <DiffView diff={e.diff} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost" size="sm" onClick={loadMore} loading={isLoadingMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Build to verify**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add dashboard/src/pages/AuditLog.tsx
git commit -m "feat: add AuditLog page with day grouping, diff view, type filter, and CSV export"
```

---

## Task 15: Wire all new routes in main.tsx

**Files:**
- Modify: `dashboard/src/main.tsx`

**Step 1: Read current main.tsx**

```bash
cat /Users/t0405/Developer/playbook_backend/dashboard/src/main.tsx
```

**Step 2: Update routes**

The routes for app sub-pages should be updated to use the new pages. Find the section that mounts `AppConfig` and replace it with the three new config pages. Add `AuditLog`. The route structure should look like:

```typescript
import AgentPrompt from "./pages/AgentPrompt";
import LlmConfig from "./pages/LlmConfig";
import LimitsConfig from "./pages/LimitsConfig";
import AuditLog from "./pages/AuditLog";
// Keep existing: Functions, Sessions, ApiKeys, Playbooks

// In the router, under the /apps/:appId layout:
{ path: "agent", element: <AgentPrompt /> },
{ path: "llm", element: <LlmConfig /> },
{ path: "limits", element: <LimitsConfig /> },
{ path: "functions", element: <Functions /> },
{ path: "sessions", element: <Sessions /> },
{ path: "api-keys", element: <ApiKeys /> },
{ path: "playbooks", element: <Playbooks /> },
{ path: "audit", element: <AuditLog /> },
```

Remove the old `{ path: "config", element: <AppConfig /> }` route (or keep it temporarily redirecting to `agent` for backwards compat if needed — but since this is a dev dashboard, just remove it).

Also remove `AppConfig` import.

**Step 3: Update the Apps page nav chips**

In `dashboard/src/pages/Apps.tsx`, update `APP_NAV_ITEMS`:
```typescript
const APP_NAV_ITEMS = [
  { label: "Agent", slug: "agent" },
  { label: "LLM", slug: "llm" },
  { label: "Limits", slug: "limits" },
  { label: "Functions", slug: "functions" },
  { label: "Sessions", slug: "sessions" },
  { label: "API Keys", slug: "api-keys" },
  { label: "Playbooks", slug: "playbooks" },
  { label: "Audit", slug: "audit" },
];
```

**Step 4: Final build**

```bash
cd /Users/t0405/Developer/playbook_backend/dashboard && npm run build 2>&1
```

Expected: zero TypeScript errors. Note the total bundle size.

**Step 5: Smoke test**

```bash
docker compose up --build -d
sleep 5
curl -s http://localhost:8000/health
# Navigate to http://localhost:3000 and verify:
# - Login works
# - App list shows "Agent / LLM / Limits" chips
# - Clicking an app shows the sidebar
# - LLM page shows "Test Connection" button
# - Audit Log page loads (empty is fine)
docker compose down
```

**Step 6: Commit**

```bash
git add dashboard/src/main.tsx dashboard/src/pages/Apps.tsx
git commit -m "feat: wire new config routes and retire AppConfig page"
```

---

## Summary of All Commits

1. `feat: harden API client with ApiError, signal support, and auth:expired event`
2. `feat: add custom_base_url flag to ProviderInfo schema`
3. `feat: add audit_events table`
4. `feat: add AuditService.emit`
5. `feat: emit audit events on config updates`
6. `feat: emit audit events for function and api key changes`
7. `feat: add audit events endpoint GET /v1/apps/:id/audit-events`
8. `feat: add POST /v1/apps/:id/config/test for LLM connection testing`
9. `feat: add AppSidebar with dirty-state dots and refactor Layout`
10. `feat: add AgentPrompt config page with dirty-state tracking`
11. `feat: add LlmConfig page with test connection and dirty-state tracking`
12. `feat: add LimitsConfig page with temperature slider and dirty-state tracking`
13. `feat: sessions page — pagination, AbortController, error state, metadata header, tool call cards`
14. `feat: add AuditLog page with day grouping, diff view, type filter, and CSV export`
15. `feat: wire new config routes and retire AppConfig page`
