# Documentation Index

This index is optimized for both engineers and LLM-based coding agents.

## Agent Entry Points

- [Agent Map](../AGENTS.md)
- [Agent-First Harness Notes](agent-first/README.md)

## Architecture and Service Boundaries

- [Service Overview](backend/services-overview.md)
- [Platform Ownership Split](backend/platform-ownership-split.md)
- [Orchestrator Flow](backend/orchestrator-flow.md)
- [Data Model Map](backend/data-model-map.md)

## API and Capabilities

- [SDK Capabilities Reference](backend/sdk-capabilities-reference.md)
- [iOS App Agent Capabilities](backend/ios-app-agent-capabilities.md)
- [KB Service Capabilities](backend/kb-service-capabilities.md)
- [Router Map](backend/router-map.md)
- [Error Contracts](backend/error-contracts.md)
- [SDK-to-Backend Integration Map](backend/integration-map-sdk-to-backend.md)

## Configuration and Operations

- [Environment Reference](backend/config-env-reference.md)
- [Local Dev + Docker Runbook](backend/runbooks/local-dev-and-docker.md)

## Planning and Change History

- [Execution Plans](exec-plans/README.md)
- [Tech Debt Tracker](exec-plans/tech-debt-tracker.md)
- [Reports](reports/)

## Protocol References

- [SDK Integration Protocol](../SDK_INTEGRATION.md)

## Generated API Contracts

- [dashboard OpenAPI JSON](generated/openapi/dashboard.openapi.json)
- [agent OpenAPI JSON](generated/openapi/agent.openapi.json)
- [knowledge_bases OpenAPI JSON](generated/openapi/knowledge_bases.openapi.json)

Regenerate snapshots:

- `uv run python scripts/export_openapi.py`
- `uv run python scripts/check_openapi_sync.py`
