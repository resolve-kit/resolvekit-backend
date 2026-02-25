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
- Recrawls or deletes individual sources.
- Tracks source status, crawl timestamps, and source-level errors.

Key model: `KnowledgeSource`.

## Document and Chunk Pipeline

- Crawls/parses source content to markdown/text.
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

