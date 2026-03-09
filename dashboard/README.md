# Dashboard (Next.js)

This package now serves two roles:

1. Dashboard UI (`dash` origin)
2. Dashboard API boundary (`api` origin) via Next route handlers at `/v1/*`

## Environment

- `NEXT_PUBLIC_API_BASE_URL`
  - Browser-facing API base URL used by dashboard client code.
- `NEXT_PUBLIC_RESOLVEKIT_ENABLED`
  - Enables dashboard copilot widget integration (`true`/`false`).
- `RESOLVEKIT_KEY`
  - Server-side ResolveKit API key used by the `/api/resolvekit/token` proxy route. Required when copilot is enabled.
- `RESOLVEKIT_SERVER_AGENT_BASE_URL`
  - Optional server-only override for the `/api/resolvekit/token` proxy route.
  - It must use HTTPS unless it targets `localhost`.
  - Use this in reverse-proxy or internal-network deployments where the dashboard server must reach the agent through a server-only URL.
- `NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL`
  - Base URL for ResolveKit runtime endpoints consumed by the web SDK (normally `http://localhost:8000`).
- `/api/resolvekit/token`
  - Dashboard-owned token proxy route used by the browser SDK to mint client tokens without exposing `RESOLVEKIT_KEY`.
- `DATABASE_URL`
  - Prisma connection string for control-plane DB operations.
- `IAA_JWT_SECRET`, `IAA_JWT_ALGORITHM`, `IAA_JWT_EXPIRE_MINUTES`
  - Dashboard session token settings.
- `IAA_ENCRYPTION_KEY`
  - Fernet-compatible key for provider profile secret encryption/decryption.
  - Required in production.
  - In local `next dev` / Docker development, the dashboard can derive a stable fallback key from `IAA_JWT_SECRET` when this value is missing or invalid.
- `IAA_KNOWLEDGE_BASES_BASE_URL`, `IAA_KNOWLEDGE_BASES_AUDIENCE`, `IAA_KNOWLEDGE_BASES_SIGNING_KEY`, `IAA_KNOWLEDGE_BASES_JWT_ALGORITHM`
  - KB internal service integration settings for dashboard API route handlers.
- `IAA_CORS_ALLOWED_ORIGINS`
  - Comma-separated list of allowed browser origins for cross-origin `/v1/*` requests to the `api` origin.
  - Same-host origins are also allowed automatically (for example, `http://<host>:3000` -> `http://<host>:3002`).
## Commands

- `npm run dev`
- `npm run build`
- `npm run start`

## Notes

- Existing dashboard views are currently mounted as a client-side app within Next.
- `/v1/*` route handlers preserve the existing dashboard API contract while owning control-plane behavior directly in Next.
