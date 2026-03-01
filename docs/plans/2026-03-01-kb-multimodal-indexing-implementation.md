# KB Multimodal Indexing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multimodal KB indexing that downloads and stores relevant tutorial images, runs OCR + vision captioning, links image evidence to parent articles, and exposes image metadata in retrieval hits.

**Architecture:** Extend crawling to emit image candidates, add deterministic relevance filtering (cap 6/page), persist image assets via local KB storage + new image asset table, and generate image-derived chunks in the existing retrieval index. Keep ingestion fail-open per image and preserve existing text ingestion behavior.

**Tech Stack:** FastAPI, SQLAlchemy async, Postgres JSONB, httpx, litellm, optional PIL/pytesseract, pytest.

---

### Task 1: Extend crawl structures with image candidates

**Files:**
- Modify: `knowledge_bases/services/crawling.py`
- Test: `tests/test_kb_crawling_markdown.py`
- Create: `tests/test_kb_crawling_images.py`

**Step 1: Write failing tests**
- Add tests that HTML image candidates are extracted with normalized absolute URLs, context/heading, and include external CDN images.
- Add tests that decorative/nav images are still detectable for later scoring metadata.

**Step 2: Run tests (expect fail)**
Run: `uv run pytest tests/test_kb_crawling_images.py -v`

**Step 3: Implement minimal code**
- Add `CrawledImage` dataclass and extend `CrawledPage` with `images`.
- Extend parser extraction to emit image candidates with contextual metadata.
- Ensure crawl4ai and httpx crawl paths populate `images`.

**Step 4: Run tests (expect pass)**
Run: `uv run pytest tests/test_kb_crawling_images.py tests/test_kb_crawling_markdown.py -v`

### Task 2: Add multimodal relevance + storage/caption helpers

**Files:**
- Create: `knowledge_bases/services/multimodal.py`
- Modify: `knowledge_bases/config.py`
- Create: `tests/test_kb_multimodal_service.py`

**Step 1: Write failing tests**
- Relevance ranking returns top relevant images and enforces max=6.
- CDN image URLs are accepted.
- Decorative/tiny/icon patterns are downranked.
- Storage path + hash handling works and dedupes writes.

**Step 2: Run tests (expect fail)**
Run: `uv run pytest tests/test_kb_multimodal_service.py -v`

**Step 3: Implement minimal code**
- Add scoring/filter function (`select_relevant_images`).
- Add download + type/size checks.
- Add local asset persistence helpers.
- Add OCR and vision caption best-effort helpers with graceful fallback.

**Step 4: Run tests (expect pass)**
Run: `uv run pytest tests/test_kb_multimodal_service.py -v`

### Task 3: Add KB image asset model and ingestion integration

**Files:**
- Modify: `knowledge_bases/models.py`
- Modify: `knowledge_bases/services/ingestion.py`
- Create: `tests/test_kb_ingestion_multimodal.py`

**Step 1: Write failing tests**
- Ingestion creates image assets + image chunks linked to parent document.
- `chunk.metadata_json` includes `modality`, `image_asset_path`, `image_source_url`, `parent_canonical_url`, `dom_index`.
- Stats include image counts.

**Step 2: Run tests (expect fail)**
Run: `uv run pytest tests/test_kb_ingestion_multimodal.py -v`

**Step 3: Implement minimal code**
- Add `KnowledgeImageAsset` model.
- During source ingestion, process selected page images and create image assets/chunks.
- Keep text ingestion unchanged.

**Step 4: Run tests (expect pass)**
Run: `uv run pytest tests/test_kb_ingestion_multimodal.py tests/test_kb_ingestion_dedup.py -v`

### Task 4: Cleanup lifecycle and search hit metadata

**Files:**
- Modify: `knowledge_bases/services/ingestion.py`
- Modify: `knowledge_bases/router.py`
- Modify: `knowledge_bases/services/search.py`
- Create: `tests/test_kb_multimodal_cleanup.py`
- Modify: `tests/test_kb_search_service.py`

**Step 1: Write failing tests**
- Recrawl/source/document deletion removes associated asset files (best-effort).
- Search hits surface image metadata for image-derived chunks.

**Step 2: Run tests (expect fail)**
Run: `uv run pytest tests/test_kb_multimodal_cleanup.py tests/test_kb_search_service.py -v`

**Step 3: Implement minimal code**
- Add cleanup helpers for asset file removal.
- Wire cleanup in recrawl path and delete routes.
- Extend search hit payload with optional modality/image fields.

**Step 4: Run tests (expect pass)**
Run: `uv run pytest tests/test_kb_multimodal_cleanup.py tests/test_kb_search_service.py -v`

### Task 5: Verification + docs

**Files:**
- Modify: `docs/backend/kb-service-capabilities.md`
- Modify: `docs/backend/router-map.md` (if response shape docs need update)

**Step 1: Full targeted verification**
Run:
- `uv run pytest tests/test_kb_crawling_images.py tests/test_kb_multimodal_service.py tests/test_kb_ingestion_multimodal.py tests/test_kb_multimodal_cleanup.py tests/test_kb_search_service.py -v`
- `uv run pytest tests/test_orchestrator_kb_internal_tool.py tests/test_orchestrator_kb_tool_result_flow.py -v`

**Step 2: Runtime sanity**
Run: `uv run pytest tests/test_kb_upload_file_route.py tests/test_kb_document_conversion.py -v`

**Step 3: Update docs**
- Document image capture rules, relevance cap, and article linkage metadata.

