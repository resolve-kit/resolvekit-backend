---
title: "ResolveKit — Version Compatibility Matrix"
created: 2026-04-30
---

# ResolveKit — Version Compatibility Matrix

This document tracks which SDK versions are compatible with which backend versions.

## Compatibility Table

| Backend Version | iOS SDK | Android SDK | Web SDK | Notes |
| --- | --- | --- | --- | --- |
| `1.0.0` | `1.4.2` | `1.0.1` | N/A | Initial OSS release |
| `1.0.0` | `1.4.1` | `1.0.0` | N/A | Compatible with minor SDK patches |
| `0.9.x` | `1.3.0` | `0.9.x` | N/A | Pre-release, not recommended for production |

## Versioning Policy

- **Backend** uses Semantic Versioning (`MAJOR.MINOR.PATCH`)
- **SDKs** use independent versioning but maintain backward compatibility within major versions
- **Breaking changes** in backend API will bump the major version
- SDKs are backward compatible with older backend versions unless a new protocol feature is required

## Protocol Version

The ResolveKit protocol version is tied to the major backend version:

- **Protocol v1** (Backend `1.x`): Current stable protocol
  - SSE (Server-Sent Events) for real-time events
  - JSON Schema for tool definitions
  - JWT-based auth

## Upgrade Guide

### Upgrading Backend
1. Review the [CHANGELOG.md](CHANGELOG.md) for breaking changes
2. Run database migrations: `uv run alembic upgrade head`
3. Update `.env` if new variables are required
4. Restart services: `docker compose up -d`

### Upgrading SDKs
1. Check compatibility table above
2. Update your dependency version in Package.swift (iOS) or build.gradle.kts (Android)
3. Review the SDK's CHANGELOG.md for API changes
4. Test with your app's existing integration

## Deprecation Policy

- Minor versions are supported for 6 months after a new minor release
- Major versions are supported for 12 months after a new major release
- Deprecated versions receive security patches but no new features
