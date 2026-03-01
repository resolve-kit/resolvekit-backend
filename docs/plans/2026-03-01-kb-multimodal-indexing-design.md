# Knowledge Base Multimodal Indexing Design

**Date:** 2026-03-01

## Objective

Implement multimodal indexing in `knowledge_bases` so crawled/tutorial pages with images can produce image-aware retrieval evidence linked to article flow.

## Product Decisions (locked)

- Capture external CDN images that appear in crawled article content.
- Download and persist image assets during ingestion.
- Keep only relevant images, capped at 6 per page.
- Use vision-model captioning during ingestion (not OCR-only).
- Keep app-level capability UI in App Model config, and keep ingestion status in KB domain.

## Current Gap

Current crawler/ingestion pipeline stores text markdown chunks only. Images are not first-class indexed assets and are not explicitly linked to article steps in retrieval output.

## Proposed Architecture

### 1) Crawl Output Extension

Extend `CrawledPage` to include normalized image candidates extracted from HTML.

Per candidate metadata:
- image URL (absolute)
- alt/title text
- nearby context text
- nearest heading
- DOM order index
- layout region hints (content vs chrome)
- optional width/height attributes if present

For crawl4ai path, gather markdown as today and run a lightweight HTML fetch/parse for image candidates.

### 2) Relevance Scoring + Cap

Apply deterministic scoring and keep top 6 images/page.

Positive signals:
- instructional nearby text and headings
- non-trivial image dimensions
- in-content region
- filename hints (`screenshot`, `step`, `settings`, `tutorial`)

Negative signals:
- logos/icons/sprites/avatars/social badges
- nav/header/footer/sidebar region
- tiny dimensions

Also dedupe by image content hash.

### 3) Asset Storage

Download selected images and store bytes in KB-managed filesystem storage (`KBS_MULTIMODAL_ASSETS_DIR`) using content-hash keying.

Do not store raw bytes in Postgres.
Store metadata + storage path references in DB.

### 4) New Image Asset Table

Add `KnowledgeImageAsset` table in KB service schema:
- org/kb/source/document linkage
- source image URL
- local storage path
- mime type, byte size, width/height
- relevance score, DOM index
- extracted OCR text + vision caption (short text)
- status/error fields

### 5) Ingestion Pipeline Changes

For each crawled page:
1. Create/update text document/chunks (existing behavior).
2. Select relevant images (top 6).
3. Download + store each image.
4. Run OCR extraction.
5. Run vision caption extraction.
6. Create image-derived `knowledge_chunks` with modality metadata (`image_ocr`, `image_caption`) and parent article linkage.

Chunk metadata should include:
- `modality`
- `image_asset_path`
- `image_source_url`
- `parent_document_id`
- `parent_canonical_url`
- `section_heading`
- `dom_index`

### 6) Search Output Enrichment

Keep retrieval in existing search path, but include image metadata fields in hits when chunk modality is image-derived, so orchestrator/runtime can cite or open source images.

### 7) Cleanup & Lifecycle

On recrawl/source delete/document delete:
- delete related `KnowledgeImageAsset` records
- remove local files (best-effort, non-fatal)

### 8) Runtime Behavior Compatibility

- `ocr_safe`: runtime can rely on text + OCR-derived evidence.
- `multimodal`: runtime can additionally use image-caption chunks and linked assets for visual reasoning.

Indexing is mode-agnostic; mode controls runtime consumption.

## Risk Controls

- strict download limits (type/size/timeouts)
- capped image count per page
- fail-open ingestion if OCR/caption step fails for a specific image
- no hard dependency on optional OCR libs (degrade gracefully)

## Test Plan

- crawler image extraction + URL normalization tests
- relevance scoring/filtering tests (ensures “relevant ones” and cap=6)
- ingestion tests for image chunk/link metadata creation
- cleanup tests for recrawl/delete removing asset files
- search tests validating image metadata surfacing

## Rollout

Phase 2 deliverable for multimodal indexing:
- completed once image assets are downloaded, captioned, indexed, linked to parent docs, and searchable with modality metadata.
