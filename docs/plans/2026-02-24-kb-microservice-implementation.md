# Knowledge Base Microservice Implementation Plan

## Goal
Build a separately deployable `kb-service` for crawl/ingest/search while keeping `core-api` as the only public API. Customers manage knowledge bases from dashboard, assign KBs to apps, and session orchestration can query assigned KB content via backend tools.

## Architecture Decisions
- `core-api` remains public surface and auth boundary.
- `kb-service` is private/internal and owns KB operational data.
- Service-to-service auth uses signed short-lived JWT.
- App-to-KB assignment metadata lives in `core-api` database.
- KB crawl/index/search data lives in `kb-service` database.
- Retrieval mode is hybrid lexical + semantic-style scoring (initially implemented with embeddings + cosine in service layer).

## Deliverables
1. New `kb_service` package (FastAPI app, internal router, DB models, worker loop).
2. New KB gateway router in `core-api`.
3. New core DB tables for KB references and app assignments.
4. Orchestrator integration for KB lookup tool execution.
5. Dashboard pages/routes for KB management and assignment.
6. Docker Compose split deployment (`backend`, `dashboard`, `kb-service`, `kb-db`, existing `db`).

## Tasks

### 1) Planning + Interface Contracts
- [x] Define microservice ownership boundaries.
- [x] Define internal API contracts between `core-api` and `kb-service`.
- [x] Define public gateway endpoints exposed by `core-api`.

### 2) Core API Data Model + Migration
- [x] Add `KnowledgeBaseRef` model (org-scoped external KB reference).
- [x] Add `AppKnowledgeBase` join model (many-to-many app↔KB).
- [x] Add Alembic migration for new core tables and indexes.
- [x] Register models in model exports.

### 3) Service-to-Service Client/Auth
- [x] Add KB service settings in core config (URL, signing key, audience).
- [x] Implement signed JWT generator for internal KB calls.
- [x] Implement resilient KB HTTP client wrapper (timeouts, error normalization).

### 4) Core Public KB Gateway Endpoints
- [x] Add router for public KB CRUD/search/source/job/document endpoints.
- [x] Enforce org membership and role checks.
- [x] Enforce app ownership for assignment endpoints.
- [x] Proxy requests to `kb-service` with org context.

### 5) KB Microservice Foundation
- [x] Create `kb_service/main.py` with startup lifecycle.
- [x] Add async DB layer and models for:
  - knowledge bases
  - sources
  - documents
  - chunks
  - jobs
  - org embedding config
- [x] Add internal auth middleware/dependency validating service JWT.
- [x] Add internal API router with CRUD/source/job/document/search endpoints.

### 6) Crawl + Ingestion + Search Pipeline
- [x] Implement URL ingestion and same-host/subpath guardrails.
- [x] Implement crawl fetch and text extraction.
- [x] Implement chunking + dedup.
- [x] Implement embedding abstraction and semantic scoring.
- [x] Implement hybrid query strategy (keyword + cosine blend).
- [x] Implement background worker to process queued jobs.
- [x] Add manual recrawl support.

### 7) Session Tool Integration
- [x] Add internal KB tool schema to orchestrator when app has assigned KBs.
- [x] Execute KB tool calls in backend (no SDK roundtrip).
- [x] Persist KB tool results as `tool_result` messages.

### 8) Dashboard UX
- [x] Add top-nav `Knowledge Bases` entry.
- [x] Add `/knowledge-bases` page (list/create/delete).
- [x] Add KB detail page for sources, jobs, documents, and search.
- [x] Add app-level assignment page `/apps/:appId/knowledge-bases`.
- [x] Add assignment links/chips in app navigation.

### 9) Deployment + Runtime
- [x] Add `kb-db` and `kb-service` to docker-compose.
- [x] Add Dockerfile/entrypoint for kb-service.
- [x] Ensure internal networking from core->kb.
- [x] Rebuild containers and verify health.

### 10) Validation
- [x] Build dashboard (`npm run build`).
- [x] Run backend test suite or targeted tests.
- [x] Smoke test flows:
  - create KB
  - add source
  - observe job
  - assign to app
  - query in KB search
  - confirm session KB tool path works

## Acceptance Criteria
- [x] Dashboard shows `Knowledge Bases` as top-level section.
- [x] Customers can create multiple KBs and assign each KB to multiple apps.
- [x] URL source ingestion runs asynchronously and stores searchable content.
- [x] Search API supports keyword and natural-language query.
- [x] Chat orchestration can retrieve data from assigned KBs through backend tool execution.
- [x] `kb-service` runs independently and can be deployed/scaled separately.

## Validation Evidence (2026-02-24)
- `npm --prefix dashboard run build` passed.
- `uv run python -m pytest -q` passed.
- Targeted KB regression tests passed:
  - `tests/test_kb_ingestion_dedup.py`
  - `tests/test_kb_search_service.py`
  - `tests/test_orchestrator_kb_internal_tool.py`
  - `tests/test_orchestrator_kb_tool_result_flow.py`
- End-to-end smoke flow passed via backend API:
  - signup org owner
  - create app
  - create KB
  - add upload source
  - wait for ingestion job completion
  - query KB search (>=1 hit)
  - assign KB to app and verify assignment list
