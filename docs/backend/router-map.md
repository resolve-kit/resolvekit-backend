# Router Map

This map groups endpoints by router and responsibility. For exact request/response schemas, use:

- [`agent.openapi.json`](../generated/openapi/agent.openapi.json)
- [`knowledge_bases.openapi.json`](../generated/openapi/knowledge_bases.openapi.json)

## `agent` routers

## Auth (`agent/routers/auth.py`)

- `POST /v1/auth/signup`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `GET /v1/auth/password-guidance`

## Organizations (`agent/routers/organizations.py`)

- `GET /v1/organizations/me`
- `GET /v1/organizations/llm/providers`
- `GET /v1/organizations/embedding-models`
- `GET /v1/organizations/llm-models`
- `GET /v1/organizations/llm-profiles`
- `POST /v1/organizations/llm-profiles`
- `PATCH /v1/organizations/llm-profiles/{profile_id}`
- `DELETE /v1/organizations/llm-profiles/{profile_id}`
- `POST /v1/organizations/invitations`
- `GET /v1/organizations/invitations/received`
- `GET /v1/organizations/invitations/sent`
- `POST /v1/organizations/invitations/{invitation_id}/accept`
- `DELETE /v1/organizations/invitations/{invitation_id}`
- `GET /v1/organizations/members`
- `PATCH /v1/organizations/members/{member_id}/role`

## Apps (`agent/routers/apps.py`)

- `POST /v1/apps`
- `GET /v1/apps`
- `GET /v1/apps/{app_id}`
- `PATCH /v1/apps/{app_id}`
- `DELETE /v1/apps/{app_id}`

## API keys (`agent/routers/api_keys.py`)

- `POST /v1/apps/{app_id}/api-keys`
- `GET /v1/apps/{app_id}/api-keys`
- `DELETE /v1/apps/{app_id}/api-keys/{key_id}`

## Config (`agent/routers/config.py`)

- `GET /v1/apps/{app_id}/config`
- `PUT /v1/apps/{app_id}/config`
- `GET /v1/apps/{app_id}/config/providers`
- `GET /v1/apps/{app_id}/config/models`
- `POST /v1/apps/{app_id}/config/models`
- `POST /v1/apps/{app_id}/config/test`

## Audit (`agent/routers/audit.py`)

- `GET /v1/apps/{app_id}/audit-events`

## Functions (`agent/routers/functions.py`)

SDK-facing:

- `PUT /v1/functions/bulk`
- `GET /v1/functions`
- `GET /v1/functions/eligible`

Dashboard-facing:

- `GET /v1/apps/{app_id}/functions`
- `PATCH /v1/apps/{app_id}/functions/{function_id}`
- `DELETE /v1/apps/{app_id}/functions/{function_id}`

## Playbooks (`agent/routers/playbooks.py`)

- `POST /v1/apps/{app_id}/playbooks`
- `GET /v1/apps/{app_id}/playbooks`
- `GET /v1/apps/{app_id}/playbooks/{playbook_id}`
- `PATCH /v1/apps/{app_id}/playbooks/{playbook_id}`
- `DELETE /v1/apps/{app_id}/playbooks/{playbook_id}`
- `PUT /v1/apps/{app_id}/playbooks/{playbook_id}/functions`

## Sessions (`agent/routers/sessions.py`)

SDK-facing:

- `POST /v1/sessions`
- `POST /v1/sessions/{session_id}/ws-ticket`

Dashboard-facing:

- `GET /v1/apps/{app_id}/sessions`
- `GET /v1/apps/{app_id}/sessions/{session_id}/messages`

## Chat WS (`agent/routers/chat_ws.py`)

- `WS /v1/sessions/{session_id}/ws`

## Chat HTTP/SSE (`agent/routers/chat_http.py`)

- `POST /v1/sessions/{session_id}/messages` (SSE stream)
- `POST /v1/sessions/{session_id}/tool-results`

## SDK compatibility (`agent/routers/sdk.py`)

- `GET /v1/sdk/compat`

## Knowledge bases (`agent/routers/knowledge_bases.py`)

Knowledge base lifecycle:

- `GET /v1/knowledge-bases`
- `POST /v1/knowledge-bases`
- `GET /v1/knowledge-bases/{kb_id}`
- `PATCH /v1/knowledge-bases/{kb_id}`
- `POST /v1/knowledge-bases/{kb_id}/embedding-change-impact`
- `DELETE /v1/knowledge-bases/{kb_id}`

Source/document lifecycle:

- `GET /v1/knowledge-bases/{kb_id}/sources`
- `POST /v1/knowledge-bases/{kb_id}/sources/url`
- `POST /v1/knowledge-bases/{kb_id}/sources/upload`
- `POST /v1/knowledge-bases/{kb_id}/sources/upload-file`
- `POST /v1/knowledge-bases/{kb_id}/sources/{source_id}/recrawl`
- `DELETE /v1/knowledge-bases/{kb_id}/sources/{source_id}`
- `GET /v1/knowledge-bases/{kb_id}/jobs`
- `GET /v1/knowledge-bases/{kb_id}/documents`
- `DELETE /v1/knowledge-bases/{kb_id}/documents/{document_id}`
- `POST /v1/knowledge-bases/{kb_id}/search`

App assignments:

- `GET /v1/apps/{app_id}/knowledge-bases`
- `PUT /v1/apps/{app_id}/knowledge-bases`

Embedding profile management:

- `GET /v1/organizations/embedding-profiles`
- `POST /v1/organizations/embedding-profiles`
- `PATCH /v1/organizations/embedding-profiles/{profile_id}`
- `POST /v1/organizations/embedding-profiles/{profile_id}/change-impact`
- `DELETE /v1/organizations/embedding-profiles/{profile_id}`

## `knowledge_bases` router (`knowledge_bases/router.py`)

All endpoints are under `/internal/*`.

Knowledge bases:

- `POST /internal/kbs/list`
- `POST /internal/kbs/create`
- `POST /internal/kbs/get`
- `POST /internal/kbs/update`
- `POST /internal/kbs/embedding-change-impact`
- `POST /internal/kbs/delete`

Sources:

- `POST /internal/sources/list`
- `POST /internal/sources/add-url`
- `POST /internal/sources/add-upload`
- `POST /internal/sources/add-upload-file`
- `POST /internal/sources/recrawl`
- `POST /internal/sources/delete`

Jobs/documents/search:

- `POST /internal/jobs/list`
- `POST /internal/documents/list`
- `POST /internal/documents/delete`
- `POST /internal/search`
- `POST /internal/search/multi-kb`

Embedding profiles:

- `POST /internal/embedding-profiles/list`
- `POST /internal/embedding-profiles/create`
- `POST /internal/embedding-profiles/change-impact`
- `POST /internal/embedding-profiles/update`
- `POST /internal/embedding-profiles/delete`

Health:

- `GET /internal/health`
