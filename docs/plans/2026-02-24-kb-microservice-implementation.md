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
- [ ] Add `KnowledgeBaseRef` model (org-scoped external KB reference).
- [ ] Add `AppKnowledgeBase` join model (many-to-many app↔KB).
- [ ] Add Alembic migration for new core tables and indexes.
- [ ] Register models in model exports.

### 3) Service-to-Service Client/Auth
- [ ] Add KB service settings in core config (URL, signing key, audience).
- [ ] Implement signed JWT generator for internal KB calls.
- [ ] Implement resilient KB HTTP client wrapper (timeouts, error normalization).

### 4) Core Public KB Gateway Endpoints
- [ ] Add router for public KB CRUD/search/source/job/document endpoints.
- [ ] Enforce org membership and role checks.
- [ ] Enforce app ownership for assignment endpoints.
- [ ] Proxy requests to `kb-service` with org context.

### 5) KB Microservice Foundation
- [ ] Create `kb_service/main.py` with startup lifecycle.
- [ ] Add async DB layer and models for:
  - knowledge bases
  - sources
  - documents
  - chunks
  - jobs
  - org embedding config
- [ ] Add internal auth middleware/dependency validating service JWT.
- [ ] Add internal API router with CRUD/source/job/document/search endpoints.

### 6) Crawl + Ingestion + Search Pipeline
- [ ] Implement URL ingestion and same-host/subpath guardrails.
- [ ] Implement crawl fetch and text extraction.
- [ ] Implement chunking + dedup.
- [ ] Implement embedding abstraction and semantic scoring.
- [ ] Implement hybrid query strategy (keyword + cosine blend).
- [ ] Implement background worker to process queued jobs.
- [ ] Add manual recrawl support.

### 7) Session Tool Integration
- [ ] Add internal KB tool schema to orchestrator when app has assigned KBs.
- [ ] Execute KB tool calls in backend (no SDK roundtrip).
- [ ] Persist KB tool results as `tool_result` messages.

### 8) Dashboard UX
- [ ] Add top-nav `Knowledge Bases` entry.
- [ ] Add `/knowledge-bases` page (list/create/delete).
- [ ] Add KB detail page for sources, jobs, documents, and search.
- [ ] Add app-level assignment page `/apps/:appId/knowledge-bases`.
- [ ] Add assignment links/chips in app navigation.

### 9) Deployment + Runtime
- [ ] Add `kb-db` and `kb-service` to docker-compose.
- [ ] Add Dockerfile/entrypoint for kb-service.
- [ ] Ensure internal networking from core->kb.
- [ ] Rebuild containers and verify health.

### 10) Validation
- [ ] Build dashboard (`npm run build`).
- [ ] Run backend test suite or targeted tests.
- [ ] Smoke test flows:
  - create KB
  - add source
  - observe job
  - assign to app
  - query in KB search
  - confirm session KB tool path works

## Acceptance Criteria
- Dashboard shows `Knowledge Bases` as top-level section.
- Customers can create multiple KBs and assign each KB to multiple apps.
- URL source ingestion runs asynchronously and stores searchable content.
- Search API supports keyword and natural-language query.
- Chat orchestration can retrieve data from assigned KBs through backend tool execution.
- `kb-service` runs independently and can be deployed/scaled separately.
