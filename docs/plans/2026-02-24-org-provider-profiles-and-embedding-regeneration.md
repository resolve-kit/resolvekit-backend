# Organization Provider Profiles + KB Embedding Regeneration Plan

## Summary
Implement organization-level provider management with hard cutover from app-level LLM secrets, and add knowledge-base-level embedding profile selection with explicit regeneration confirmation and impact estimates.

## Locked Decisions
- LLM providers are configured at organization scope as reusable profiles.
- App config stores a reference (`llm_profile_id`) and selects from org profiles.
- Embedding providers are configured at organization scope as reusable embedding profiles.
- Knowledge bases select one embedding profile each.
- Changing embedding provider/model requires explicit confirmation when indexed chunks exist.
- Regeneration runs asynchronously; old vectors remain active until job completion, then swap atomically.

## API Contracts

### Core API
- `GET /v1/organizations/llm/providers`
- `GET /v1/organizations/llm-profiles`
- `POST /v1/organizations/llm-profiles`
- `PATCH /v1/organizations/llm-profiles/{profile_id}`
- `DELETE /v1/organizations/llm-profiles/{profile_id}`

- `GET /v1/apps/{app_id}/config`
  - now returns `llm_profile_id`, `llm_profile_name`, `llm_provider`, `llm_model`, `has_llm_api_key`
- `PUT /v1/apps/{app_id}/config`
  - app-level LLM selection now uses `llm_profile_id`

- `POST /v1/knowledge-bases/{kb_id}/embedding-change-impact`
- `GET /v1/organizations/embedding-profiles`
- `POST /v1/organizations/embedding-profiles`
- `PATCH /v1/organizations/embedding-profiles/{profile_id}`
- `POST /v1/organizations/embedding-profiles/{profile_id}/change-impact`
- `DELETE /v1/organizations/embedding-profiles/{profile_id}`

### KB Internal Service
- `POST /internal/embedding-profiles/list`
- `POST /internal/embedding-profiles/create`
- `POST /internal/embedding-profiles/update`
- `POST /internal/embedding-profiles/change-impact`
- `POST /internal/embedding-profiles/delete`
- `POST /internal/kbs/embedding-change-impact`

## Data Model Changes

### Core API DB
- Added `organization_llm_provider_profiles` table.
- Added `agent_configs.llm_profile_id` foreign key.
- Legacy app-level LLM columns remain present but are deprecated and not used for runtime selection.

### KB Service DB
- Added `organization_embedding_profiles` table.
- Knowledge base stores active embedding runtime snapshot:
  - `embedding_profile_id`, `embedding_provider`, `embedding_model`, `embedding_api_key_encrypted`, `embedding_api_base`
- Knowledge base stores pending embedding runtime snapshot for queued regeneration:
  - `pending_embedding_profile_id`, `pending_embedding_provider`, `pending_embedding_model`, `pending_embedding_api_key_encrypted`, `pending_embedding_api_base`
  - `embedding_regeneration_status`, `embedding_regeneration_error`
- Jobs include `target_embedding_profile_id` and support `job_type="reembed_kb"`.

## Regeneration + Cost Warning Flow

### KB embedding profile change
1. Client calls impact endpoint.
2. If `chunk_count > 0`, client shows warning and cost estimate.
3. Update is sent with `confirm_regeneration=true`.
4. KB keeps active vectors/runtime unchanged.
5. Re-embed job updates chunk vectors using pending runtime.
6. On success, pending runtime is promoted to active in same transaction.

### Embedding profile provider/model change
1. Client calls profile change-impact endpoint with proposed provider/model.
2. If affected chunks exist, client shows warning and estimate.
3. Update with `confirm_regeneration=true` queues re-embed jobs for affected KBs.
4. KBs continue using active vectors/runtime until job completion.

## Error Handling
- Confirmation-required conflicts return `409` with code:
  - `EMBEDDING_REGEN_CONFIRMATION_REQUIRED`
- Invalid cross-org references return `404`.
- Delete profile blocked when in use.

## Dashboard Changes
- Organization Admin now includes org-level LLM profile management (create/list/delete).
- App LLM config now selects from organization LLM profiles.
- Knowledge Bases page now includes:
  - embedding profile management (create/list/edit/delete)
  - KB-level embedding profile assignment
  - impact preview + confirmation modal for costly embedding changes
  - regeneration status visibility

## Verification
- `uv run python -m pytest -q` passed.
- `npm --prefix dashboard run build` passed.

## Operational Note
- No new Alembic revision added for this change set.
- Expected rollout path is DB reset/wipe and fresh startup so schema aligns with updated models and revised migration chain.
