#!/bin/sh
set -eu

: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is required}"
: "${LETSENCRYPT_CERT_NAME:?LETSENCRYPT_CERT_NAME is required}"
: "${RESOLVEKIT_MARKETING_HOST:?RESOLVEKIT_MARKETING_HOST is required}"
: "${RESOLVEKIT_CONSOLE_HOST:?RESOLVEKIT_CONSOLE_HOST is required}"
: "${RESOLVEKIT_API_HOST:?RESOLVEKIT_API_HOST is required}"
: "${RESOLVEKIT_AGENT_HOST:?RESOLVEKIT_AGENT_HOST is required}"

cert_file="/etc/letsencrypt/live/${LETSENCRYPT_CERT_NAME}/fullchain.pem"
issuer="$(openssl x509 -in "${cert_file}" -noout -issuer 2>/dev/null || true)"

needs_issue=0
if [ -z "${issuer}" ]; then
  needs_issue=1
elif [ "${LETSENCRYPT_STAGING:-1}" = "0" ] && printf '%s' "${issuer}" | grep -qi "Fake LE"; then
  needs_issue=1
elif ! printf '%s' "${issuer}" | grep -qi "Let's Encrypt"; then
  needs_issue=1
fi

if [ "${needs_issue}" = "1" ]; then
  if [ "${LETSENCRYPT_STAGING:-1}" = "1" ]; then
    certbot certonly \
      --webroot -w /var/www/certbot \
      --non-interactive \
      --agree-tos \
      --no-eff-email \
      --email "${LETSENCRYPT_EMAIL}" \
      --cert-name "${LETSENCRYPT_CERT_NAME}" \
      --force-renewal \
      --staging \
      -d "${RESOLVEKIT_MARKETING_HOST}" \
      -d "${RESOLVEKIT_CONSOLE_HOST}" \
      -d "${RESOLVEKIT_API_HOST}" \
      -d "${RESOLVEKIT_AGENT_HOST}" || true
  else
    certbot certonly \
      --webroot -w /var/www/certbot \
      --non-interactive \
      --agree-tos \
      --no-eff-email \
      --email "${LETSENCRYPT_EMAIL}" \
      --cert-name "${LETSENCRYPT_CERT_NAME}" \
      --force-renewal \
      -d "${RESOLVEKIT_MARKETING_HOST}" \
      -d "${RESOLVEKIT_CONSOLE_HOST}" \
      -d "${RESOLVEKIT_API_HOST}" \
      -d "${RESOLVEKIT_AGENT_HOST}" || true
  fi
fi

while true; do
  if [ "${LETSENCRYPT_STAGING:-1}" = "1" ]; then
    certbot renew --webroot -w /var/www/certbot --quiet --staging
  else
    certbot renew --webroot -w /var/www/certbot --quiet
  fi

  sleep 12h
done
