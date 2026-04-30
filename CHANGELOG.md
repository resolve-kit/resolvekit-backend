# Changelog

All notable changes to the ResolveKit Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-30

### Added
- FastAPI agent service with WebSocket event streaming
- Knowledge bases service with document ingestion, embedding, and search
- Next.js admin dashboard with full app management UI
- Dashboard API routes () for programmatic access
- OpenAPI specs for agent, dashboard, and knowledge_bases APIs
- Docker Compose configs for local and production deployment
- Caddy reverse proxy configuration
- Alembic database migrations (21 migrations)
- Organization management with invitations and roles
- LLM provider profiles with encrypted secrets
- Chat theme customization per app
- Chat localization support (multi-language)
- Function registry with allowlist scoping
- Playbook system for structured agent flows
- Usage tracking and cost calculation
- Audit event logging
- Session reconnect with ticket-based auth
- Agent config with scope mode (strict/permissive)
- Pending tool results for approval workflows
- Turn state service for agent context persistence

### Changed
- Migrated to uv for Python dependency management
- Dashboard split into separate Next.js app with API routes
- Knowledge bases separated into dedicated service

### Security
- Fernet encryption for provider profile secrets
- SDK client token auth with JWT
- CORS configuration for dashboard origins
- Rate limiting on auth endpoints

