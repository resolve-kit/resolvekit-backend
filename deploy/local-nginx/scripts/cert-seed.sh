#!/bin/sh
set -eu

: "${LETSENCRYPT_CERT_NAME:?LETSENCRYPT_CERT_NAME is required}"
: "${RESOLVEKIT_PUBLIC_HOST:?RESOLVEKIT_PUBLIC_HOST is required}"

cert_dir="/etc/letsencrypt/live/${LETSENCRYPT_CERT_NAME}"
fullchain="${cert_dir}/fullchain.pem"
privkey="${cert_dir}/privkey.pem"

if [ -s "${fullchain}" ] && [ -s "${privkey}" ]; then
  exit 0
fi

mkdir -p "${cert_dir}"
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 1 \
  -keyout "${privkey}" \
  -out "${fullchain}" \
  -subj "/CN=${RESOLVEKIT_PUBLIC_HOST}"
