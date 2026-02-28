# Dashboard (Next.js)

This package now serves two roles:

1. Dashboard UI (`dash` origin)
2. Dashboard API boundary (`api` origin) via Next route handlers at `/v1/*`

## Environment

- `NEXT_PUBLIC_API_BASE_URL`
  - Browser-facing API base URL used by dashboard client code.
- `DATABASE_URL`
  - Prisma connection string for control-plane DB operations.
- `IAA_JWT_SECRET`, `IAA_JWT_ALGORITHM`, `IAA_JWT_EXPIRE_MINUTES`
  - Dashboard session token settings.
- `IAA_ENCRYPTION_KEY`
  - Fernet-compatible key for provider profile secret encryption/decryption.
- `IAA_KNOWLEDGE_BASES_BASE_URL`, `IAA_KNOWLEDGE_BASES_AUDIENCE`, `IAA_KNOWLEDGE_BASES_SIGNING_KEY`, `IAA_KNOWLEDGE_BASES_JWT_ALGORITHM`
  - KB internal service integration settings for dashboard API route handlers.

## Commands

- `npm run dev`
- `npm run build`
- `npm run start`

## Notes

- Existing dashboard views are currently mounted as a client-side app within Next.
- `/v1/*` route handlers preserve the existing dashboard API contract while owning control-plane behavior directly in Next.
