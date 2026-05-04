from pathlib import Path


def test_compose_keeps_dashboard_and_api_services_only() -> None:
    text = Path("docker-compose.yml").read_text(encoding="utf-8")
    assert "dashboard:" in text
    assert "api:" in text
    assert "website:" not in text


def test_env_example_declares_dashboard_api_base() -> None:
    text = Path(".env.example").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_API_BASE_URL=" in text
    assert "RESOLVEKIT_PUBLIC_HOST=support.example.com" in text
    assert "RESOLVEKIT_CONSOLE_HOST=" not in text
    assert "RESOLVEKIT_API_HOST=" not in text
    assert "RESOLVEKIT_AGENT_HOST=" not in text
    assert "resolvekit.app" not in text


def test_prod_examples_default_to_split_host_self_hosting() -> None:
    env_text = Path(".env.prod.example").read_text(encoding="utf-8")
    compose_text = Path("docker-compose.prod.yml").read_text(encoding="utf-8")

    assert "RESOLVEKIT_CONSOLE_HOST=console.example.com" in env_text
    assert "RESOLVEKIT_API_HOST=api.example.com" in env_text
    assert "RESOLVEKIT_AGENT_HOST=agent.example.com" in env_text
    assert "RESOLVEKIT_PUBLIC_HOST=" not in env_text
    assert "NEXT_PUBLIC_DASHBOARD_URL=https://console.example.com" in env_text
    assert "NEXT_PUBLIC_API_BASE_URL=https://api.example.com" in env_text
    assert "NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL=" not in env_text
    assert "RESOLVEKIT_KEY=" not in env_text
    assert 'RK_CORS_ORIGINS=["https://console.example.com","https://api.example.com"]' in env_text
    assert "RK_CORS_ALLOWED_ORIGINS=https://console.example.com" in env_text
    assert "resolvekit.app" not in env_text

    assert "NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL:-https://api.example.com}" in compose_text
    assert "RESOLVEKIT_SERVER_AGENT_BASE_URL: ${RESOLVEKIT_SERVER_AGENT_BASE_URL:-http://backend:8000}" in compose_text
    assert "RK_CORS_ALLOWED_ORIGINS: ${RK_CORS_ALLOWED_ORIGINS:-https://console.example.com}" in compose_text


def test_local_deploy_compose_drops_marketing_origin_defaults() -> None:
    env_text = Path(".env.local-deploy.example").read_text(encoding="utf-8")
    compose_text = Path("docker-compose.local-deploy.yml").read_text(encoding="utf-8")

    assert "RESOLVEKIT_PUBLIC_HOST=support-dev.example.com" in env_text
    assert "NEXT_PUBLIC_DASHBOARD_URL=https://support-dev.example.com" in env_text
    assert "NEXT_PUBLIC_API_BASE_URL=https://support-dev.example.com" in env_text
    assert "NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL=" not in env_text
    assert "RESOLVEKIT_KEY=" not in env_text
    assert 'RK_CORS_ORIGINS=["https://support-dev.example.com"]' in env_text
    assert "RK_CORS_ALLOWED_ORIGINS=https://support-dev.example.com" in env_text
    assert "resolvekit-dev.example.com" not in env_text

    assert "NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL:-https://support-dev.example.com}" in compose_text
    assert "RESOLVEKIT_SERVER_AGENT_BASE_URL: ${RESOLVEKIT_SERVER_AGENT_BASE_URL:-http://backend:8000}" in compose_text
    assert 'RK_CORS_ORIGINS: \'${RK_CORS_ORIGINS:-["https://support-dev.example.com"]}\'' in compose_text
    assert "RK_CORS_ALLOWED_ORIGINS: ${RK_CORS_ALLOWED_ORIGINS:-https://support-dev.example.com}" in compose_text


def test_ingress_templates_default_to_single_public_host_routing() -> None:
    caddy_prod = Path("deploy/caddy/Caddyfile.prod").read_text(encoding="utf-8")
    caddy_local = Path("deploy/caddy/Caddyfile.local-deploy").read_text(encoding="utf-8")
    nginx_template = Path("deploy/local-nginx/templates/resolvekit.local.conf.template").read_text(encoding="utf-8")
    certbot_loop = Path("deploy/local-nginx/scripts/certbot-loop.sh").read_text(encoding="utf-8")
    cert_seed = Path("deploy/local-nginx/scripts/cert-seed.sh").read_text(encoding="utf-8")

    assert "{$RESOLVEKIT_CONSOLE_HOST}" in caddy_prod
    assert "{$RESOLVEKIT_API_HOST}" in caddy_prod
    assert "{$RESOLVEKIT_AGENT_HOST}" in caddy_prod
    assert "{$RESOLVEKIT_PUBLIC_HOST}" not in caddy_prod
    assert "uri strip_prefix /agent" not in caddy_prod
    assert "reverse_proxy backend:8000" in caddy_prod
    assert "reverse_proxy api:3000" in caddy_prod
    assert "reverse_proxy dashboard:3000" in caddy_prod

    assert "{$RESOLVEKIT_PUBLIC_HOST}" in caddy_local
    assert "uri strip_prefix /agent" in caddy_local
    assert "reverse_proxy backend:8000" in caddy_local
    assert "reverse_proxy api:3000" in caddy_local
    assert "reverse_proxy dashboard:3000" in caddy_local
    assert "RESOLVEKIT_CONSOLE_HOST" not in caddy_local
    assert "RESOLVEKIT_API_HOST" not in caddy_local
    assert "RESOLVEKIT_AGENT_HOST" not in caddy_local

    assert "server_name ${RESOLVEKIT_PUBLIC_HOST};" in nginx_template
    assert "location /agent/" in nginx_template
    assert "proxy_pass http://backend:8000/;" in nginx_template
    assert "location /v1/" in nginx_template
    assert "proxy_pass http://api:3000;" in nginx_template
    assert "proxy_pass http://dashboard:3000;" in nginx_template
    assert "RESOLVEKIT_CONSOLE_HOST" not in nginx_template
    assert "RESOLVEKIT_API_HOST" not in nginx_template
    assert "RESOLVEKIT_AGENT_HOST" not in nginx_template

    assert 'RESOLVEKIT_PUBLIC_HOST:?RESOLVEKIT_PUBLIC_HOST is required' in certbot_loop
    assert 'RESOLVEKIT_PUBLIC_HOST:?RESOLVEKIT_PUBLIC_HOST is required' in cert_seed
    assert '-d "${RESOLVEKIT_PUBLIC_HOST}"' in certbot_loop
    assert '/CN=${RESOLVEKIT_PUBLIC_HOST}' in cert_seed
