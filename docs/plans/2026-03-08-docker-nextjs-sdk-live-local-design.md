# Docker Next.js SDK Live Local Design

**Date:** 2026-03-08

## Goal

Align local, local-deploy, and prod Docker paths to the new `@resolvekit/nextjs` integration while preserving live local SDK iteration from a mounted SDK checkout.

## Chosen Approach

Use the local SDK repo as a Docker build/runtime source everywhere, but treat it as a packed `@resolvekit/nextjs` package rather than the old `@resolvekit/sdk` source tree. Local `docker-compose.yml` will mount the SDK checkout read-only and build/install it inside the `dashboard` and `api` containers before starting Next. Image-based compose files will pass the SDK repo as an additional build context so `dashboard/Dockerfile` can build and pack it during image creation.

## Scope

- Rename Docker SDK path wiring from `resolvekit-web-sdk` / `RESOLVEKIT_WEB_SDK_PATH` to `resolvekit-nextjs-sdk` / `RESOLVEKIT_NEXTJS_SDK_PATH`
- Replace old public key env usage with server-only `RESOLVEKIT_KEY`
- Update local compose service bootstrap scripts to install `@resolvekit/nextjs`
- Update `dashboard/Dockerfile` to build/package the mounted Next.js SDK
- Update contract tests to lock the Docker configuration to the new integration

## Non-Goals

- Publishing a new npm package flow
- Removing live-local SDK support from Docker
- Refactoring unrelated backend or website services
