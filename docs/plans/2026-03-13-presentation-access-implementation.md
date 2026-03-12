# Presentation Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add password-only access control and an opaque public slug for the presentation page and all related demo media.

**Architecture:** Use shared helpers in `website/src/lib/presentation-access.ts` for env-backed slug and cookie validation. Route all access through `website/src/middleware.ts`, render the password form at `/enter`, and keep the presentation implementation at the internal route `/presentation` while rewriting the opaque public slug to it.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, middleware, server actions, Python contract tests

---

### Task 1: Add a failing contract test

**Files:**
- Create: `tests/test_website_presentation_access_contract.py`
- Test: `tests/test_website_presentation_access_contract.py`

**Step 1: Write the failing test**

Assert that:
- `website/src/middleware.ts` exists
- `website/src/app/enter/page.tsx` exists
- `website/src/lib/presentation-access.ts` exists
- the middleware references `PRESENTATION_PASSWORD`, `PRESENTATION_SLUG`, and `/enter`

**Step 2: Run test to verify it fails**

Run: `uv run python -m pytest tests/test_website_presentation_access_contract.py -q`
Expected: FAIL because the files do not exist yet.

### Task 2: Implement middleware-protected access

**Files:**
- Create: `website/src/lib/presentation-access.ts`
- Create: `website/src/middleware.ts`
- Create: `website/src/app/enter/actions.ts`
- Create: `website/src/app/enter/page.tsx`
- Modify: `website/src/app/presentation/page.tsx`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.local-deploy.yml`

**Step 1: Write minimal implementation**

- Add env-backed helpers for slug, cookie, and media paths
- Add middleware to redirect unauthorized requests to `/enter`
- Add a password-only screen with a branded form
- Update presentation media paths to use the opaque slug
- Add website env vars to compose files

**Step 2: Run test to verify it passes**

Run:
- `uv run python -m pytest tests/test_website_presentation_access_contract.py -q`
- `npm run build`

Expected:
- contract test passes
- website build succeeds
