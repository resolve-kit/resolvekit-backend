# Data Model Map

This map covers the primary entities used across runtime, governance, and KB integration.

## `agent` domain

## Identity and tenancy

- `DeveloperAccount`
  - Developer identity and organization membership/role.
- `Organization`
  - Tenant boundary for apps and provider profiles.
- `OrganizationInvitation`
  - Membership invitation flow.
- `OrganizationLLMProviderProfile`
  - Shared LLM credentials/model profile used by app configs.

## App and runtime configuration

- `App`
  - Per-product container for config, keys, functions, playbooks, sessions.
- `ApiKey`
  - App-scoped SDK auth credentials.
- `AgentConfig`
  - App assistant behavior and runtime settings:
    - prompts
    - model limits
    - scope mode
    - profile binding

## Tooling and workflows

- `RegisteredFunction`
  - SDK function schemas and runtime eligibility metadata.
- `Playbook`
  - Structured workflow definition.
- `PlaybookFunction`
  - Ordered relation between playbook and registered functions.

## Runtime chat

- `ChatSession`
  - Session lifecycle and context payloads:
    - `client_context`
    - `llm_context`
    - `available_function_names`
- `Message`
  - Ordered conversation records (user/assistant/tool).
- `WSTicket`
  - One-time WS auth ticket.

## Observability and governance

- `AuditEvent`
  - Structured audit log entries for config/management actions.

## KB bridge references (local to `agent`)

- `KnowledgeBaseRef`
  - Local record mapping org-scoped external KB ID.
- `AppKnowledgeBase`
  - App-to-KB assignment join table.

`agent` does not store KB documents/chunks directly.

## `knowledge_bases` domain

- `OrganizationEmbeddingProfile`
  - Embedding model/provider credential profile.
- `KnowledgeBase`
  - KB metadata + embedding runtime state.
- `KnowledgeSource`
  - Source definitions (`url`/`upload`) and crawl state.
- `KnowledgeDocument`
  - Normalized crawled/uploaded documents.
- `KnowledgeChunk`
  - Chunked content + embedding vectors.
- `KnowledgeIngestionJob`
  - Async ingestion/regeneration job tracking.

## Cross-Service Relationships

- App config in `agent` selects LLM profile in `agent` DB.
- KB data lives in `knowledge_bases` DB; app-level assignments live in `agent`.
- `agent` calls `knowledge_bases` APIs and syncs local reference tables.

## Source Files

- `agent` models: [`agent/models`](../../agent/models)
- `knowledge_bases` models: [`knowledge_bases/models.py`](../../knowledge_bases/models.py)
