# Documentation Index

This index is optimized for both engineers and LLM-based coding agents.

## Architecture and Service Boundaries

- [Service Overview](backend/services-overview.md)
- [Orchestrator Flow](backend/orchestrator-flow.md)
- [Data Model Map](backend/data-model-map.md)

## API and Capabilities

- [iOS App Agent Capabilities](backend/ios-app-agent-capabilities.md)
- [KB Service Capabilities](backend/kb-service-capabilities.md)
- [Router Map](backend/router-map.md)
- [Error Contracts](backend/error-contracts.md)
- [SDK-to-Backend Integration Map](backend/integration-map-sdk-to-backend.md)

## Configuration and Operations

- [Environment Reference](backend/config-env-reference.md)
- [Local Dev + Docker Runbook](backend/runbooks/local-dev-and-docker.md)

## Protocol References

- [SDK Integration Protocol](../SDK_INTEGRATION.md)

## Generated API Contracts

- [agent OpenAPI JSON](generated/openapi/agent.openapi.json)
- [knowledge_bases OpenAPI JSON](generated/openapi/knowledge_bases.openapi.json)

Regenerate snapshots:

- `uv run python scripts/export_openapi.py`
- `uv run python scripts/check_openapi_sync.py`

