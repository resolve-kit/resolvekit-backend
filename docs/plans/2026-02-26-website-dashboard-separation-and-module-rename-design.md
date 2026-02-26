# Website/Dashboard Separation + Backend Module Rename Design

**Date:** 2026-02-26
**Status:** Approved
**Scope:** Separate marketing website from dashboard, adopt `dash` + `api` subdomains, and hard-rename backend modules.

## Context

Current state combines marketing pages and dashboard pages inside the same React/Vite app (`dashboard`) and uses relative API calls proxied by the dashboard container. The backend Python packages are named `ios_app_agent` and `kb_service`.

The target state is:
- New dedicated website application using Next.js + Tailwind + shadcn.
- Existing dashboard remains a separate Vite app.
- Dashboard runs on `dash.<domain>` and calls API on `api.<domain>` directly.
- Hard-cut rename (no compatibility layer):
  - `ios_app_agent` -> `agent`
  - `kb_service` -> `knowledge_bases`

---

## 1. Architecture

### 1.1 Application boundaries

- `website` (new): Next.js app for public marketing pages.
- `dashboard` (existing): Vite app for authenticated product configuration.
- `api` (existing backend runtime): FastAPI + services, exposed as API-only service.

Each app is independently deployable and versioned in the same monorepo.

### 1.2 Domain model

- `www.<domain>` (or apex): website
- `dash.<domain>`: dashboard
- `api.<domain>`: backend API

Dashboard API requests are direct cross-origin requests from `dash` to `api`.

### 1.3 Auth model

Per decision, keep the existing dashboard token/JWT approach:
- Dashboard stores and sends bearer token as today.
- API validates token and authorization as today.
- No cross-subdomain shared session/cookie work in this phase.

---

## 2. Hard Rename Strategy

### 2.1 Package/directory renames

- Rename source directories:
  - `/ios_app_agent` -> `/agent`
  - `/kb_service` -> `/knowledge_bases`

### 2.2 Python import and runtime updates

- Rewrite all imports in code and tests:
  - `from ios_app_agent...` -> `from agent...`
  - `from kb_service...` -> `from knowledge_bases...`
- Update runtime entrypoints:
  - `main.py`: `uvicorn.run("agent.main:app", ...)`
  - Root `Dockerfile` CMD: `agent.main:app`
  - Compose and Docker build paths to use `knowledge_bases/Dockerfile`

### 2.3 Docs/artifact naming updates

- Rename generated OpenAPI artifacts:
  - `docs/generated/openapi/ios_app_agent.openapi.json` -> `docs/generated/openapi/agent.openapi.json`
  - `docs/generated/openapi/kb_service.openapi.json` -> `docs/generated/openapi/knowledge_bases.openapi.json`
- Update references in README/docs/scripts to new names.

### 2.4 Compatibility policy

No compatibility aliases/shims are added. Old module paths break immediately by design.

---

## 3. Website and Dashboard Separation Details

### 3.1 New website app

- Add `/website` as a Next.js app.
- UI foundation: Tailwind + shadcn components.
- Initial pages: public marketing pages currently in dashboard (home/pricing equivalent) moved into website.
- Dashboard-only pages stay under `/dashboard`.

### 3.2 Dashboard API base URL

- Dashboard API client becomes env-driven:
  - `VITE_API_BASE_URL` (e.g. `https://api.<domain>`)
- Remove dependency on same-origin `/v1` proxy assumptions.

### 3.3 CORS

Backend CORS allowlist includes:
- `https://dash.<domain>`
- `https://www.<domain>` (if website needs API calls)

CORS remains explicit and environment-driven.

---

## 4. Deployment and Local Development

### 4.1 Compose/services

- Keep separate containers/services for:
  - `backend` API
  - `knowledge-bases` service
  - `dashboard`
  - `website`
- Dashboard and website are served independently.

### 4.2 Environment configuration

- Add/adjust env vars for frontend API base URL and CORS origin list.
- Keep existing JWT/env naming unless explicitly migrated in a separate pass.

### 4.3 Runbooks/docs

Update docs to reflect:
- new folder names (`agent`, `knowledge_bases`)
- new OpenAPI artifact names
- subdomain topology (`www`, `dash`, `api`)
- separate build/start instructions for website and dashboard

---

## 5. Testing and Verification Strategy

### 5.1 Backend

- Run targeted tests for import/path-sensitive modules first.
- Run full pytest suite after rename pass.
- Verify backend startup using new entrypoint module path.

### 5.2 Dashboard

- Build/lint with `VITE_API_BASE_URL` set.
- Smoke test login and representative app routes calling `api` origin.

### 5.3 Website

- Build/lint Next.js app.
- Smoke test landing/pricing routes and component rendering.

### 5.4 Compose/system

- Verify all services build successfully with renamed paths.
- Validate dashboard->API traffic and CORS behavior in local environment.

---

## Out of Scope

- Dashboard migration from Vite to Next.js.
- Shared SSO/cookie auth across subdomains.
- Backward-compatibility import aliases for renamed backend packages.
