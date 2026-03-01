# App-Level KB Vision Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an app-level `kb_vision_mode` setting with dashboard model capability visibility and save-time validation for OCR-safe vs multimodal operation.

**Architecture:** Extend `agent_configs` as the single source of truth for app-level KB vision behavior, expose it through existing app config APIs, and validate mode/model compatibility in dashboard control-plane services. Extend model discovery responses with normalized capability flags used by dashboard UI badges and selector validation.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic, Next.js route handlers + Prisma, React + TypeScript dashboard, pytest.

---

### Task 1: Add `kb_vision_mode` to persisted app config models

**Files:**
- Modify: `agent/models/agent_config.py`
- Modify: `dashboard/prisma/schema.prisma`
- Create: `alembic/versions/017_add_kb_vision_mode_to_agent_configs.py`
- Test: `tests/test_agent_config_defaults.py`

**Step 1: Write the failing test**

Add a default assertion:

```python
def test_kb_vision_mode_column_default_is_ocr_safe() -> None:
    column = AgentConfig.__table__.c.kb_vision_mode
    assert column.default is not None
    assert column.default.arg == "ocr_safe"
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_agent_config_defaults.py::test_kb_vision_mode_column_default_is_ocr_safe -v`
Expected: FAIL because column does not exist yet.

**Step 3: Write minimal implementation**

- Add SQLAlchemy column `kb_vision_mode` (`String(20)`, default `ocr_safe`).
- Add Prisma field `kbVisionMode String @default("ocr_safe") @map("kb_vision_mode") @db.VarChar(20)`.
- Add Alembic migration adding nullable=false column with server default `ocr_safe`.

**Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_agent_config_defaults.py::test_kb_vision_mode_column_default_is_ocr_safe -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add agent/models/agent_config.py dashboard/prisma/schema.prisma alembic/versions/017_add_kb_vision_mode_to_agent_configs.py tests/test_agent_config_defaults.py
git commit -m "feat: persist app kb vision mode"
```

### Task 2: Expose and validate `kb_vision_mode` in app config API

**Files:**
- Modify: `dashboard/src/lib/server/config-service.ts`
- Modify: `dashboard/src/lib/server/serializers.ts`
- Modify: `dashboard/src/app/v1/apps/[appId]/config/route.ts`
- Test: `tests/test_dashboard_api_base_url_contract.py`

**Step 1: Write the failing test**

Add a contract test that checks app config route code includes `kb_vision_mode` read/write mapping and serializer output contains `kb_vision_mode`.

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_dashboard_api_base_url_contract.py -v`
Expected: FAIL because `kb_vision_mode` strings are missing.

**Step 3: Write minimal implementation**

- Extend route payload type with `kb_vision_mode?: "ocr_safe" | "multimodal"`.
- Map payload into config updates as `kbVisionMode`.
- Extend `ConfigUpdateData`, before/after diff tracking, and persistence update path.
- Extend `configOut` output payload to include `kb_vision_mode`.
- Validate allowed values and throw descriptive error for invalid mode.

**Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_dashboard_api_base_url_contract.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add dashboard/src/lib/server/config-service.ts dashboard/src/lib/server/serializers.ts dashboard/src/app/v1/apps/[appId]/config/route.ts tests/test_dashboard_api_base_url_contract.py
git commit -m "feat: expose kb vision mode in app config api"
```

### Task 3: Add model capability metadata for dashboard selection

**Files:**
- Modify: `dashboard/src/lib/server/provider.ts`
- Modify: `dashboard/src/app/v1/organizations/llm-models/route.ts`
- Modify: `dashboard/src/app/v1/apps/[appId]/config/models/route.ts`
- Test: `tests/test_dashboard_next_control_plane_contract.py`

**Step 1: Write the failing test**

Add assertions that model endpoints include `capabilities` in JSON response construction.

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_dashboard_next_control_plane_contract.py::test_dashboard_next_has_remaining_control_plane_routes -v`
Expected: FAIL after adding stricter content assertions.

**Step 3: Write minimal implementation**

- Extend provider `ModelInfo` with capability flags:
  - `ocr_compatible: boolean`
  - `multimodal_vision: boolean`
- Implement deterministic capability inference from model ID/name patterns.
- Return capability metadata through both model routes.

**Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_dashboard_next_control_plane_contract.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add dashboard/src/lib/server/provider.ts dashboard/src/app/v1/organizations/llm-models/route.ts dashboard/src/app/v1/apps/[appId]/config/models/route.ts tests/test_dashboard_next_control_plane_contract.py
git commit -m "feat: expose llm model capability metadata"
```

### Task 4: Add mode switch + capability badges in app LLM config UI

**Files:**
- Modify: `dashboard/src/dashboard_pages/LlmConfig.tsx`

**Step 1: Write the failing test**

Create UI behavior assertions in an existing contract-style test file by checking that source contains:
- mode field in config interface
- payload write of `kb_vision_mode`
- `Low-risk OCR` and `Full multimodal` labels
- capability badge strings

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_dashboard_api_base_url_contract.py -v`
Expected: FAIL because strings are missing.

**Step 3: Write minimal implementation**

- Extend config/interface types with `kb_vision_mode`.
- Add mode draft state and dirty tracking.
- Show selected model badges using capability flags.
- Add radio/select control for `Low-risk OCR` / `Full multimodal`.
- On submit, send `kb_vision_mode`.
- Block invalid selection (e.g., multimodal requested but model not multimodal-capable) with inline warning and disabled save.

**Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_dashboard_api_base_url_contract.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add dashboard/src/dashboard_pages/LlmConfig.tsx tests/test_dashboard_api_base_url_contract.py
git commit -m "feat: add kb vision mode control in llm config ui"
```

### Task 5: Final verification and docs sync

**Files:**
- Modify: `docs/backend/config-env-reference.md` (only if config docs mention app config payload fields)
- Modify: `docs/backend/router-map.md` (only if route payload docs include changed shape)

**Step 1: Run focused test suite**

Run:
- `uv run pytest tests/test_agent_config_defaults.py -v`
- `uv run pytest tests/test_dashboard_next_control_plane_contract.py -v`
- `uv run pytest tests/test_dashboard_api_base_url_contract.py -v`

Expected: all PASS.

**Step 2: Run broader regression guard**

Run: `uv run pytest tests/test_chat_runtime_profile.py tests/test_orchestrator_kb_internal_tool.py -v`
Expected: PASS, no runtime regressions from config shape updates.

**Step 3: Update docs if required**

Add one short section describing `kb_vision_mode` values and expected behavior.

**Step 4: Final status commit**

```bash
git add docs/backend/config-env-reference.md docs/backend/router-map.md
git commit -m "docs: document app kb vision mode" || true
```

