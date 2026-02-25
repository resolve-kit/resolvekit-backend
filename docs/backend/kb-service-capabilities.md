# KB Service Capabilities

This document describes the internal knowledge-base service (`kb_service`) used by `ios_app_agent`.

## Entry Point

- App bootstrap: [`kb_service/main.py`](../../kb_service/main.py)
- Router: [`kb_service/router.py`](../../kb_service/router.py)
- Base prefix: `/internal`
- Health endpoint: `GET /internal/health`

## Security Model

- Service-to-service JWT verification in [`kb_service/auth.py`](../../kb_service/auth.py)
- Expected claims include:
  - org context (`org_id`)
  - actor identity (`actor_id`)
  - actor role (`actor_role`)
- Signing and audience settings from [`kb_service/config.py`](../../kb_service/config.py)

## Capability Areas

## Knowledge Base Management

- Create/list/get/update/delete knowledge bases.
- Tracks active and pending embedding runtimes.
- Supports embedding regeneration workflows.

Key model: `KnowledgeBase` in [`kb_service/models.py`](../../kb_service/models.py)

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
- Converts uploaded files (MarkItDown-first with parser fallbacks).
- Deduplicates by canonical URL/content hash.
- Splits documents into chunks and computes embeddings.
- Stores chunk metadata for retrieval.

Key models:
- `KnowledgeDocument`
- `KnowledgeChunk`
- `KnowledgeIngestionJob`

Key services:
- [`kb_service/services/crawling.py`](../../kb_service/services/crawling.py)
- [`kb_service/services/ingestion.py`](../../kb_service/services/ingestion.py)
- [`kb_service/services/embedding.py`](../../kb_service/services/embedding.py)

## Search

- Semantic search within one KB (`/internal/search`).
- Semantic search across multiple KBs (`/internal/search/multi-kb`).
- Uses Postgres-native hybrid retrieval:
  - Lexical retrieval via Postgres Full-Text Search (`to_tsvector` + `websearch_to_tsquery` + `ts_rank_cd`)
  - Vector retrieval via chunk embeddings + cosine similarity
  - Weighted Reciprocal Rank Fusion (RRF) to combine lexical and semantic ranks
- Returns title/content/metadata payload used by `ios_app_agent` prompt enrichment.

Key service: [`kb_service/services/search.py`](../../kb_service/services/search.py)

## Embedding Profile Management

- List/create/update/delete organization embedding profiles.
- Validates impact before profile changes.
- Supports staged profile changes and regeneration.

Key model: `OrganizationEmbeddingProfile`.

## Worker/Job Execution

- Background worker polls pending jobs and executes ingestion/regeneration.
- Controlled by `KBS_WORKER_ENABLED`.

Key module: [`kb_service/services/worker.py`](../../kb_service/services/worker.py)

## Integration with `ios_app_agent`

`ios_app_agent` never directly reads KB DB tables. It communicates only through `kb_service` HTTP APIs via:

- [`ios_app_agent/services/kb_service_client.py`](../../ios_app_agent/services/kb_service_client.py)

`ios_app_agent` stores only reference/assignment metadata locally:

- `KnowledgeBaseRef`
- `AppKnowledgeBase`

## Related Docs

- [Router Map](router-map.md)
- [Environment Reference](config-env-reference.md)
- [OpenAPI Contract](../generated/openapi/kb_service.openapi.json)
