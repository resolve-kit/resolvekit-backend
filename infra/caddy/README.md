# Caddy Gateway (Docker)

This stack runs Caddy as an external reverse proxy for the local OSS Docker services.

## Start

1. Ensure backend stack is up:
   - `docker compose up -d`
2. Configure domains in root `.env`:
   - `CADDY_PRIMARY_HOST`
   - `CADDY_WWW_HOST`
   - `CADDY_DASH_HOST`
   - `CADDY_API_HOST`
   - `LETSENCRYPT_EMAIL`
3. Start Caddy:
   - `docker compose -f infra/caddy/docker-compose.yml up -d`

## Routing

- `https://<CADDY_PRIMARY_HOST>/` -> dashboard (`resolvekit_dashboard:3000`)
- `https://<CADDY_PRIMARY_HOST>/v1/*` -> dashboard API (`resolvekit_api:3002`)
- `https://<CADDY_PRIMARY_HOST>/agent/*` -> backend runtime (`resolvekit_backend:8000`)
- `https://<CADDY_PRIMARY_HOST>/kb/*` -> KB service (`resolvekit_kb_service:8100`)
- `https://<CADDY_API_HOST>/` -> backend runtime (`resolvekit_backend:8000`)

`/api/*` is also supported as an alias for `/v1/*`.

## Notes

- `CADDY_DOCKER_NETWORK` defaults to `resolvekit_default` (the network from `docker-compose.yml`).
- If another edge proxy already owns public `:80/:443`, set:
  - `CADDY_HTTP_BIND=127.0.0.1:18080`
  - `CADDY_HTTPS_BIND=127.0.0.1:18443`
- Keep `CADDY_LOCAL_BIND` on loopback for tailnet or local-only access (default `127.0.0.1:8080`).
