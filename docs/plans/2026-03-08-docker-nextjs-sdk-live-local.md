# Docker Next.js SDK Live Local Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all Docker stack variants use the new `@resolvekit/nextjs` SDK integration while still consuming a live local SDK checkout.

**Architecture:** Local compose services will mount the SDK checkout and install it as a packed package before starting Next. Image-based compose flows will pass the SDK checkout as an additional build context into `dashboard/Dockerfile`, which will build and pack the SDK during image creation.

**Tech Stack:** Docker Compose, Docker multi-stage builds, Next.js, npm, Python contract tests

---

### Task 1: Lock the Docker contract with failing tests

**Files:**
- Modify: `tests/test_prod_web_sdk_source_contract.py`

**Step 1: Write the failing test**

Add assertions that:
- `docker-compose.yml`, `docker-compose.prod.yml`, and `docker-compose.local-deploy.yml` refer to `RESOLVEKIT_NEXTJS_SDK_PATH`
- Docker config uses `RESOLVEKIT_KEY`, not `NEXT_PUBLIC_RESOLVEKIT_KEY`
- Docker bootstrap/install paths use `@resolvekit/nextjs`, not `@resolvekit/sdk`

**Step 2: Run test to verify it fails**

Run: `uv run python -m pytest tests/test_prod_web_sdk_source_contract.py -q`
Expected: FAIL on old compose/Dockerfile strings.

### Task 2: Update Docker runtime wiring

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.local-deploy.yml`

**Step 1: Write minimal implementation**

Update compose files to:
- use `RESOLVEKIT_NEXTJS_SDK_PATH`
- mount or pass the local Next.js SDK repo
- provide `RESOLVEKIT_KEY`
- remove `NEXT_PUBLIC_RESOLVEKIT_KEY` and stale playbook key aliases
- install/resolve `@resolvekit/nextjs`

**Step 2: Run test to verify it passes**

Run: `uv run python -m pytest tests/test_prod_web_sdk_source_contract.py -q`
Expected: PASS

### Task 3: Update dashboard image build path

**Files:**
- Modify: `dashboard/Dockerfile`

**Step 1: Keep contract test coverage green**

Ensure the same contract test covers Dockerfile expectations for:
- copied SDK context
- SDK build
- packed tarball install
- `@resolvekit/nextjs` resolution

**Step 2: Verify Dockerfile matches runtime path**

Run: `uv run python -m pytest tests/test_prod_web_sdk_source_contract.py -q`
Expected: PASS

### Task 4: Verify application builds still pass

**Files:**
- None

**Step 1: Run dashboard verification**

Run: `npm run build`
Working dir: `dashboard`
Expected: PASS

**Step 2: Run dashboard tests**

Run: `npm test`
Working dir: `dashboard`
Expected: PASS

**Step 3: Run backend verification**

Run: `uv run python -m pytest`
Expected: PASS
