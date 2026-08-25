#!/bin/sh
set -e

DOMINIO="${CERT_DOMAIN:-localhost}"
DESTINO="/etc/letsencrypt/live/${DOMINIO}"

if [ -f "${DESTINO}/fullchain.pem" ]; then
    exit 0
fi

echo "==> Sin certificado para ${DOMINIO}: se genera uno provisional autofirmado."
command -v openssl >/dev/null 2>&1 || apk add --no-cache openssl
mkdir -p "${DESTINO}"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout "${DESTINO}/privkey.pem" \
    -out "${DESTINO}/fullchain.pem" \
    -subj "/CN=${DOMINIO}" >/dev/null 2>&1
touch "${DESTINO}/.provisional"
echo "==> Provisional listo. Emite el real con: docker compose ... run --rm certbot-init"
