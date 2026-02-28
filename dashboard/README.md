# Dashboard (Next.js)

This package now serves two roles:

1. Dashboard UI (`dash` origin)
2. Dashboard API boundary (`api` origin) via Next route handlers at `/v1/*`

## Environment

- `NEXT_PUBLIC_API_BASE_URL`
  - Browser-facing API base URL used by dashboard client code.
- `AGENT_API_BASE_URL`
  - Internal upstream URL for forwarding `/v1/*` requests to Python `agent`.
- `DASHBOARD_INTERNAL_TOKEN`
  - Shared secret injected as `X-Internal-Dashboard-Token` when forwarding to `agent`.

## Commands

- `npm run dev`
- `npm run build`
- `npm run start`

## Notes

- Existing dashboard views are currently mounted as a client-side app within Next.
- `/v1/*` route handlers preserve the existing dashboard API contract while isolating browser clients from direct `agent` access.
