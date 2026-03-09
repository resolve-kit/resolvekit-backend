# Dashboard Token Server Agent URL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop `/api/resolvekit/token` from calling `localhost` inside Docker by giving the server token route its own internal agent base URL.

**Architecture:** Keep `NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL` for the browser SDK runtime, and introduce a server-only `RESOLVEKIT_SERVER_AGENT_BASE_URL` for the token proxy route. Local Docker compose will point the new variable at `http://backend:8000`, while browser-facing config remains `http://localhost:8000`.

**Tech Stack:** Next.js route handlers, Vitest, Docker Compose, environment variables

---

### Task 1: Lock the route behavior with a failing test

**Files:**
- Modify: `dashboard/src/app/api/resolvekit/token/route.test.ts`

**Step 1: Write the failing test**

Add assertions that:
- `RESOLVEKIT_SERVER_AGENT_BASE_URL` is preferred when present
- the route still falls back to `NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL` when the server-only variable is absent

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/resolvekit/token/route.test.ts`
Working dir: `dashboard`
Expected: FAIL because the route only reads the public env var today.

### Task 2: Implement the server-only route override

**Files:**
- Modify: `dashboard/src/app/api/resolvekit/token/route.ts`

**Step 1: Write minimal implementation**

Resolve `agentBaseUrl` from:
1. `RESOLVEKIT_SERVER_AGENT_BASE_URL`
2. `NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL`
3. `http://localhost:8000`

**Step 2: Run test to verify it passes**

Run: `npm test -- src/app/api/resolvekit/token/route.test.ts`
Working dir: `dashboard`
Expected: PASS

### Task 3: Align Docker and local env docs

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.local-deploy.yml`
- Modify: `dashboard/README.md`
- Modify: `docs/backend/config-env-reference.md`
- Modify: `dashboard/src/resolvekit-dashboard-integration-source.test.ts`

**Step 1: Update config wiring**

Set `RESOLVEKIT_SERVER_AGENT_BASE_URL` to the internal backend service URL where needed, while preserving the existing public agent URL for the browser.

**Step 2: Keep source/docs tests aligned**

Run: `npm test -- src/resolvekit-dashboard-integration-source.test.ts`
Working dir: `dashboard`
Expected: PASS

### Task 4: Verify the live stack

**Files:**
- None

**Step 1: Run focused dashboard tests**

Run: `npm test -- src/app/api/resolvekit/token/route.test.ts src/resolvekit-dashboard-integration-source.test.ts src/lib/server/security.test.ts`
Working dir: `dashboard`
Expected: PASS

**Step 2: Recreate local services**

Run: `docker compose up --build -d --force-recreate dashboard api`
Expected: Containers restart with the new internal URL.

**Step 3: Verify runtime**

Run:
- `curl -sS -D - http://127.0.0.1:3000`
- `docker compose logs --tail=80 dashboard`

Expected:
- dashboard returns `200 OK`
- token route no longer logs `ECONNREFUSED` for the backend URL
