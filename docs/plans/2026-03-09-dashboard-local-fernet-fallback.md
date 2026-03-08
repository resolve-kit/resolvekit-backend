# Dashboard Local Fernet Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the dashboard boot in local development without a pre-generated `IAA_ENCRYPTION_KEY`, while preserving strict production enforcement and keeping encrypted profile flows working.

**Architecture:** Extract Fernet key resolution into a shared server helper used by both the startup guard and the encrypt/decrypt code. In non-production only, derive a deterministic fallback Fernet key from the existing JWT secret when the configured encryption key is missing or invalid; production continues to require an explicit valid Fernet key.

**Tech Stack:** Next.js, TypeScript, Vitest, Node.js crypto

---

### Task 1: Lock the intended behavior with failing tests

**Files:**
- Create: `dashboard/src/lib/server/security.test.ts`

**Step 1: Write the failing test**

Add tests that prove:
- `assertDashboardSecurityConfig()` allows local development to boot when `IAA_JWT_SECRET` is secure and `IAA_ENCRYPTION_KEY` is missing or invalid.
- `assertDashboardSecurityConfig()` still throws in production when `IAA_ENCRYPTION_KEY` is missing or invalid.
- `encryptWithFernet()` and `decryptWithFernet()` round-trip using the same derived fallback key in development.

**Step 2: Run test to verify it fails**

Run: `npm test -- dashboard/src/lib/server/security.test.ts`
Working dir: `dashboard`
Expected: FAIL because no dev fallback exists yet.

### Task 2: Implement shared Fernet key resolution

**Files:**
- Modify: `dashboard/src/lib/server/security.ts`
- Modify: `dashboard/src/lib/server/fernet.ts`

**Step 1: Write minimal implementation**

Add a shared helper that:
- validates explicit Fernet keys
- derives a deterministic local-only Fernet key from `IAA_JWT_SECRET` when allowed
- returns explicit metadata so the startup guard can enforce production rules cleanly

Update `assertDashboardSecurityConfig()` and Fernet encrypt/decrypt code to use that helper.

**Step 2: Run test to verify it passes**

Run: `npm test -- dashboard/src/lib/server/security.test.ts`
Working dir: `dashboard`
Expected: PASS

### Task 3: Update local environment docs

**Files:**
- Modify: `dashboard/README.md`
- Modify: `.env.example`

**Step 1: Document the fallback**

Clarify that:
- production still requires an explicit `IAA_ENCRYPTION_KEY`
- local development can derive one automatically from `IAA_JWT_SECRET`
- supplying a real Fernet key remains supported

**Step 2: Verify docs stay aligned with behavior**

Run: `rg -n "IAA_ENCRYPTION_KEY|IAA_JWT_SECRET" dashboard/README.md .env.example`
Expected: docs mention the fallback and the production requirement.

### Task 4: Run focused verification

**Files:**
- None

**Step 1: Run dashboard tests**

Run: `npm test -- dashboard/src/lib/server/security.test.ts dashboard/src/components/ResolveKitCopilotProvider.test.tsx dashboard/src/resolvekit-dashboard-integration-source.test.ts`
Working dir: `dashboard`
Expected: PASS

**Step 2: Run dashboard build**

Run: `npm run build`
Working dir: `dashboard`
Expected: PASS

**Step 3: Verify local startup path**

Run: `docker compose ps`
Expected: dashboard service remains up after restart.
