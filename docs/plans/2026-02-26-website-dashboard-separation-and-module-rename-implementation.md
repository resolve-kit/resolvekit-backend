# Website/Dashboard Separation + Module Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split marketing website and dashboard into separate apps, route dashboard traffic to `api` origin, and hard-rename backend modules from `ios_app_agent`/`kb_service` to `agent`/`knowledge_bases`.

**Architecture:** Keep the existing dashboard as a standalone Vite SPA and add a new Next.js website app with Tailwind + shadcn. Backend remains API-only and is called cross-origin from dashboard via environment-configured API base URL. In the same change-set, rename backend Python package directories and all import/runtime references to `agent` and `knowledge_bases` with no compatibility aliases.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, pytest, Docker Compose, React + Vite (dashboard), Next.js + Tailwind + shadcn (website), nginx.

---

### Task 1: Lock the rename contract with failing backend tests

**Files:**
- Create: `tests/test_module_rename_contract.py`

**Step 1: Write the failing test**

```python
import importlib


def test_agent_package_entrypoint_exists() -> None:
    module = importlib.import_module("agent.main")
    assert hasattr(module, "app")


def test_knowledge_bases_package_entrypoint_exists() -> None:
    module = importlib.import_module("knowledge_bases.main")
    assert hasattr(module, "app")
```

**Step 2: Run test to verify it fails**

Run: `uv run python -m pytest tests/test_module_rename_contract.py -v`
Expected: FAIL with `ModuleNotFoundError` for `agent` and `knowledge_bases`.

**Step 3: Commit only the failing test scaffold**

```bash
git add tests/test_module_rename_contract.py
git commit -m "test: define module rename contract for agent and knowledge_bases"
```

---

### Task 2: Rename packages and rewrite imports

**Files:**
- Move: `ios_app_agent/` -> `agent/`
- Move: `kb_service/` -> `knowledge_bases/`
- Modify: all Python source imports under `agent/`, `knowledge_bases/`, `tests/`, `scripts/`, `alembic/`, and root `main.py`
- Modify: `pyproject.toml`

**Step 1: Rename package directories**

Run:
```bash
mv ios_app_agent agent
mv kb_service knowledge_bases
```

**Step 2: Bulk rewrite imports and module references**

Run:
```bash
rg -l "ios_app_agent|kb_service" agent knowledge_bases tests scripts alembic main.py pyproject.toml | \
  xargs perl -0pi -e 's/ios_app_agent/agent/g; s/kb_service/knowledge_bases/g'
```

**Step 3: Fix residual edge cases manually**

- Ensure package-internal imports in:
  - `agent/main.py`
  - `agent/database.py`
  - `knowledge_bases/main.py`
  - `knowledge_bases/database.py`
  are syntactically valid after rewrite.
- Confirm zero old import strings remain in Python/runtime files.

Run:
```bash
rg -n "ios_app_agent|kb_service" agent knowledge_bases tests scripts alembic main.py pyproject.toml
```
Expected: no matches.

**Step 4: Run the Task 1 tests to verify green**

Run: `uv run python -m pytest tests/test_module_rename_contract.py -v`
Expected: PASS.

**Step 5: Commit rename + import updates**

```bash
git add agent knowledge_bases tests scripts alembic main.py pyproject.toml
git commit -m "refactor: rename backend modules to agent and knowledge_bases"
```

---

### Task 3: Update runtime entrypoints and container wiring

**Files:**
- Modify: `main.py`
- Modify: `Dockerfile`
- Modify: `knowledge_bases/Dockerfile`
- Modify: `docker-compose.yml`
- Create: `tests/test_runtime_entrypoints_after_rename.py`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_main_entrypoint_uses_agent() -> None:
    text = Path("main.py").read_text(encoding="utf-8")
    assert '"agent.main:app"' in text


def test_backend_dockerfile_uses_agent() -> None:
    text = Path("Dockerfile").read_text(encoding="utf-8")
    assert "agent.main:app" in text


def test_kb_dockerfile_uses_knowledge_bases() -> None:
    text = Path("knowledge_bases/Dockerfile").read_text(encoding="utf-8")
    assert "knowledge_bases.main:app" in text
```

**Step 2: Run test to verify it fails**

Run: `uv run python -m pytest tests/test_runtime_entrypoints_after_rename.py -v`
Expected: FAIL in one or more assertions.

**Step 3: Apply runtime updates**

- `main.py`: `uvicorn.run("agent.main:app", ...)`
- `Dockerfile`:
  - copy `agent/` instead of old folder
  - CMD uses `agent.main:app`
- `knowledge_bases/Dockerfile`:
  - copy `knowledge_bases/`
  - CMD uses `knowledge_bases.main:app`
- `docker-compose.yml`:
  - KB dockerfile path becomes `knowledge_bases/Dockerfile`
  - service/db defaults use `knowledge_bases` naming where applicable

**Step 4: Re-run test to verify it passes**

Run: `uv run python -m pytest tests/test_runtime_entrypoints_after_rename.py -v`
Expected: PASS.

**Step 5: Commit runtime wiring changes**

```bash
git add main.py Dockerfile knowledge_bases/Dockerfile docker-compose.yml tests/test_runtime_entrypoints_after_rename.py
git commit -m "chore: update runtime entrypoints and compose wiring for renamed modules"
```

---

### Task 4: Rename OpenAPI snapshot targets and sync scripts/docs

**Files:**
- Create: `tests/test_openapi_snapshot_names.py`
- Modify: `scripts/export_openapi.py`
- Modify: `scripts/check_openapi_sync.py`
- Rename: `docs/generated/openapi/ios_app_agent.openapi.json` -> `docs/generated/openapi/agent.openapi.json`
- Rename: `docs/generated/openapi/kb_service.openapi.json` -> `docs/generated/openapi/knowledge_bases.openapi.json`
- Modify: `README.md`, `docs/INDEX.md`, `docs/backend/*.md` references to OpenAPI filenames

**Step 1: Write the failing test**

```python
from scripts.export_openapi import export_openapi


def test_openapi_export_targets_renamed_files() -> None:
    written = export_openapi()
    names = {path.name for path in written}
    assert names == {"agent.openapi.json", "knowledge_bases.openapi.json"}
```

**Step 2: Run test to verify failure**

Run: `uv run python -m pytest tests/test_openapi_snapshot_names.py -v`
Expected: FAIL showing old names are emitted.

**Step 3: Update scripts and docs to new names**

- `scripts/export_openapi.py` imports `agent.main` + `knowledge_bases.main` and writes renamed filenames.
- `scripts/check_openapi_sync.py` validates renamed filenames.
- Rename committed snapshot files to new names and refresh references in docs.

**Step 4: Verify green**

Run:
- `uv run python -m pytest tests/test_openapi_snapshot_names.py -v`
- `uv run python scripts/export_openapi.py`
- `uv run python scripts/check_openapi_sync.py`

Expected: test PASS and sync script reports in-sync.

**Step 5: Commit OpenAPI and docs updates**

```bash
git add scripts/export_openapi.py scripts/check_openapi_sync.py docs/generated/openapi README.md docs/INDEX.md docs/backend tests/test_openapi_snapshot_names.py
git commit -m "chore: rename openapi snapshots and update references"
```

---

### Task 5: Make dashboard API base explicit for `dash` -> `api`

**Files:**
- Create: `tests/test_dashboard_api_base_url_contract.py`
- Modify: `dashboard/src/api/client.ts`
- Modify: `dashboard/Dockerfile`
- Modify: `dashboard/nginx.conf`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_dashboard_client_uses_env_api_base() -> None:
    text = Path("dashboard/src/api/client.ts").read_text(encoding="utf-8")
    assert "VITE_API_BASE_URL" in text
    assert 'const BASE = ""' not in text
```

**Step 2: Run test to verify failure**

Run: `uv run python -m pytest tests/test_dashboard_api_base_url_contract.py -v`
Expected: FAIL because client currently hardcodes empty base.

**Step 3: Implement minimal dashboard infra changes**

- `dashboard/src/api/client.ts`:

```ts
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const BASE = RAW_BASE.replace(/\/$/, "");
```

- `dashboard/Dockerfile` build stage:

```dockerfile
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build
```

- `dashboard/nginx.conf`: remove `/v1` proxy block (dashboard should call API domain directly).

**Step 4: Verify green**

Run:
- `uv run python -m pytest tests/test_dashboard_api_base_url_contract.py -v`
- `npm --prefix dashboard run build`

Expected: test PASS and dashboard build succeeds.

**Step 5: Commit dashboard API-base changes**

```bash
git add dashboard/src/api/client.ts dashboard/Dockerfile dashboard/nginx.conf tests/test_dashboard_api_base_url_contract.py
git commit -m "feat: configure dashboard api base url for cross-origin api subdomain"
```

---

### Task 6: Scaffold new `website` app (Next.js + Tailwind + shadcn)

**Files:**
- Create: `website/**` (new Next.js app)
- Create: `tests/test_website_scaffold_contract.py`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_website_app_scaffold_exists() -> None:
    assert Path("website/package.json").exists()
    assert Path("website/src/app/page.tsx").exists()
    assert Path("website/src/app/pricing/page.tsx").exists()
```

**Step 2: Run test to verify failure**

Run: `uv run python -m pytest tests/test_website_scaffold_contract.py -v`
Expected: FAIL because `website/` does not exist yet.

**Step 3: Create website app and initialize shadcn**

Run:
```bash
npm create next-app@latest website -- --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm --yes
cd website
npx shadcn@latest init -y
```

Then implement initial pages/components:
- `website/src/app/page.tsx` (landing)
- `website/src/app/pricing/page.tsx` (pricing)
- shadcn button/card components under `website/src/components/ui/*`

**Step 4: Verify green**

Run:
- `uv run python -m pytest tests/test_website_scaffold_contract.py -v`
- `npm --prefix website run build`

Expected: test PASS and website build succeeds.

**Step 5: Commit website scaffold**

```bash
git add website tests/test_website_scaffold_contract.py
git commit -m "feat: add nextjs website app with tailwind and shadcn"
```

---

### Task 7: Restrict dashboard to dashboard-only routes

**Files:**
- Create: `tests/test_dashboard_route_scope_contract.py`
- Modify: `dashboard/src/main.tsx`
- Remove: `dashboard/src/pages/Home.tsx`
- Remove: `dashboard/src/pages/Pricing.tsx`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_dashboard_has_no_marketing_routes() -> None:
    text = Path("dashboard/src/main.tsx").read_text(encoding="utf-8")
    assert 'path="/pricing"' not in text
    assert 'path="/" element={<Home />}' not in text
```

**Step 2: Run test to verify failure**

Run: `uv run python -m pytest tests/test_dashboard_route_scope_contract.py -v`
Expected: FAIL because Home/Pricing routes still exist.

**Step 3: Apply route cleanup**

- Update `dashboard/src/main.tsx`:
  - remove `Home` and `Pricing` imports/routes
  - route `/` to auth-aware destination (e.g., `/apps` if token else `/login`)
- Delete removed marketing page files from dashboard.

**Step 4: Verify green**

Run:
- `uv run python -m pytest tests/test_dashboard_route_scope_contract.py -v`
- `npm --prefix dashboard run build`

Expected: PASS + successful build.

**Step 5: Commit dashboard route separation**

```bash
git add dashboard/src/main.tsx tests/test_dashboard_route_scope_contract.py
git rm dashboard/src/pages/Home.tsx dashboard/src/pages/Pricing.tsx
git commit -m "refactor: keep dashboard app routes focused on product workflows"
```

---

### Task 8: Wire CORS/env/compose for `dash` + `api` + website service

**Files:**
- Create: `tests/test_subdomain_env_contract.py`
- Modify: `agent/config.py`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: docs (`docs/backend/config-env-reference.md`, `docs/backend/runbooks/local-dev-and-docker.md`, `README.md`)

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_compose_has_website_service() -> None:
    text = Path("docker-compose.yml").read_text(encoding="utf-8")
    assert "website:" in text


def test_env_example_declares_dashboard_api_base() -> None:
    text = Path(".env.example").read_text(encoding="utf-8")
    assert "VITE_API_BASE_URL=" in text
```

**Step 2: Run test to verify failure**

Run: `uv run python -m pytest tests/test_subdomain_env_contract.py -v`
Expected: FAIL (missing website service and API base var).

**Step 3: Implement infra updates**

- `agent/config.py`: set CORS defaults to local dashboard/website dev origins.
- `.env.example`:
  - add `VITE_API_BASE_URL=http://localhost:8000`
  - adjust renamed DB/service defaults to `agent` / `knowledge_bases` terms.
- `docker-compose.yml`:
  - add `website` service (port 3001)
  - pass `VITE_API_BASE_URL` build arg into dashboard build.

**Step 4: Verify green**

Run:
- `uv run python -m pytest tests/test_subdomain_env_contract.py -v`
- `docker compose config > /tmp/playbook-compose.rendered.yml`

Expected: test PASS and compose renders without errors.

**Step 5: Commit env/compose/docs wiring**

```bash
git add agent/config.py .env.example docker-compose.yml README.md docs/backend/config-env-reference.md docs/backend/runbooks/local-dev-and-docker.md tests/test_subdomain_env_contract.py
git commit -m "chore: configure subdomain-ready env and compose wiring"
```

---

### Task 9: Final regression verification and closeout

**Files:**
- Modify (if needed from fixes): any files touched in Tasks 1-8

**Step 1: Run targeted backend tests introduced in this plan**

Run:
```bash
uv run python -m pytest \
  tests/test_module_rename_contract.py \
  tests/test_runtime_entrypoints_after_rename.py \
  tests/test_openapi_snapshot_names.py \
  tests/test_dashboard_api_base_url_contract.py \
  tests/test_website_scaffold_contract.py \
  tests/test_dashboard_route_scope_contract.py \
  tests/test_subdomain_env_contract.py -v
```

Expected: all PASS.

**Step 2: Run full backend test suite**

Run: `uv run python -m pytest`
Expected: PASS with no regressions.

**Step 3: Run frontend production builds**

Run:
- `npm --prefix dashboard run build`
- `npm --prefix website run build`

Expected: both builds PASS.

**Step 4: Verify OpenAPI snapshots are in sync**

Run: `uv run python scripts/check_openapi_sync.py`
Expected: `OpenAPI snapshots are in sync.`

**Step 5: Final commit for verification-driven fixes**

```bash
git add -A
git commit -m "chore: finalize website-dashboard split and backend module rename"
```
