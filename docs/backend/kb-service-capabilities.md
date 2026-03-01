# KB Service Capabilities

This document describes the internal knowledge-base service (`knowledge_bases`) used by `agent`.

## Entry Point

- App bootstrap: [`knowledge_bases/main.py`](../../knowledge_bases/main.py)
- Router: [`knowledge_bases/router.py`](../../knowledge_bases/router.py)
- Base prefix: `/internal`
- Health endpoint: `GET /internal/health`

## Security Model

- Service-to-service JWT verification in [`knowledge_bases/auth.py`](../../knowledge_bases/auth.py)
- Expected claims include:
  - org context (`org_id`)
  - actor identity (`actor_id`)
  - actor role (`actor_role`)
- Signing and audience settings from [`knowledge_bases/config.py`](../../knowledge_bases/config.py)

## Capability Areas

## Knowledge Base Management

- Create/list/get/update/delete knowledge bases.
- Tracks active and pending embedding runtimes.
- Supports embedding regeneration workflows.

Key model: `KnowledgeBase` in [`knowledge_bases/models.py`](../../knowledge_bases/models.py)

## Source Management

- Adds URL or uploaded content as knowledge sources.
- Accepts file uploads via multipart ingestion and converts them to markdown/text.
- Recrawls URL sources or deletes individual sources.
- Tracks source status, crawl timestamps, and source-level errors.

Key model: `KnowledgeSource`.

### File Upload Formats and Limits

- Public bridge route: `POST /v1/knowledge-bases/{kb_id}/sources/upload-file`
- Internal route: `POST /internal/sources/add-upload-file`
- Supported file extensions (default):
  - `.txt`, `.md`, `.markdown`
  - `.pdf`
  - `.doc`, `.docx`
  - `.ppt`, `.pptx`
  - `.rtf`, `.odt`
  - `.html`, `.htm`
  - `.csv`, `.tsv`
  - `.xlsx`, `.xls`
  - `.json`, `.xml`, `.yaml`, `.yml`
- Default max file size: `25 MB` (`KBS_UPLOAD_MAX_FILE_BYTES=26214400`)
- OCR for scanned/image-first files is feature-flagged and disabled by default (`KBS_UPLOAD_OCR_ENABLED=false`)

## Document and Chunk Pipeline

- Crawls/parses source content to markdown/text.
- Extracts in-content image candidates from crawled HTML (including CDN-hosted assets).
- Converts uploaded files (MarkItDown-first with parser fallbacks).
- Deduplicates by canonical URL/content hash.
- Splits documents into chunks and computes embeddings.
- Downloads relevant page images (top 6 per page), stores local KB assets, and indexes:
  - OCR-derived chunks (`modality=image_ocr`)
  - Vision-caption chunks (`modality=image_caption`)
- Stores chunk metadata for retrieval.

### Multimodal Image Indexing

- Relevance scoring prefers tutorial/screenshot-like images and downranks decorative UI chrome (logos/icons/nav).
- Indexed image chunks include article linkage metadata:
  - parent document/article URL
  - image source URL
  - local asset path
  - section heading and DOM position
- Asset files are cleaned up on recrawl/source delete/document delete (best effort).

Key models:
- `KnowledgeDocument`
- `KnowledgeChunk`
- `KnowledgeImageAsset`
- `KnowledgeIngestionJob`

Key services:
- [`knowledge_bases/services/crawling.py`](../../knowledge_bases/services/crawling.py)
- [`knowledge_bases/services/ingestion.py`](../../knowledge_bases/services/ingestion.py)
- [`knowledge_bases/services/embedding.py`](../../knowledge_bases/services/embedding.py)

## Search

- Semantic search within one KB (`/internal/search`).
- Semantic search across multiple KBs (`/internal/search/multi-kb`).
- Uses Postgres-native hybrid retrieval:
  - Lexical retrieval via Postgres Full-Text Search (`to_tsvector` + `websearch_to_tsquery` + `ts_rank_cd`)
  - Vector retrieval via chunk embeddings + cosine similarity
  - Weighted Reciprocal Rank Fusion (RRF) to combine lexical and semantic ranks
- Returns title/content/metadata payload used by `agent` prompt enrichment.
- Search hits may include multimodal metadata for image-derived chunks:
  - `modality`
  - `image_source_url`
  - `image_asset_path`
  - `section_heading`

Key service: [`knowledge_bases/services/search.py`](../../knowledge_bases/services/search.py)

## Embedding Profile Management

- List/create/update/delete organization embedding profiles.
- Validates impact before profile changes.
- Supports staged profile changes and regeneration.

Key model: `OrganizationEmbeddingProfile`.

## Worker/Job Execution

- Background worker polls pending jobs and executes ingestion/regeneration.
- Controlled by `KBS_WORKER_ENABLED`.

Key module: [`knowledge_bases/services/worker.py`](../../knowledge_bases/services/worker.py)

## Integration with `agent`

`agent` never directly reads KB DB tables. It communicates only through `knowledge_bases` HTTP APIs via:

- [`agent/services/knowledge_bases_client.py`](../../agent/services/knowledge_bases_client.py)

`agent` stores only reference/assignment metadata locally:

- `KnowledgeBaseRef`
- `AppKnowledgeBase`

## Related Docs

- [Router Map](router-map.md)
- [Environment Reference](config-env-reference.md)
- [OpenAPI Contract](../generated/openapi/knowledge_bases.openapi.json)
