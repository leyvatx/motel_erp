#!/bin/sh
set -e

: "${CERT_DOMAIN:?falta CERT_DOMAIN en api/.env}"
: "${CERT_EMAIL:?falta CERT_EMAIL en api/.env}"

DESTINO="/etc/letsencrypt/live/${CERT_DOMAIN}"

if [ -f "${DESTINO}/.provisional" ]; then
    echo "==> Se retira el certificado provisional de ${CERT_DOMAIN}."
    rm -rf "${DESTINO}"
fi

certbot certonly --webroot -w /var/www/certbot \
    -d "${CERT_DOMAIN}" \
    --email "${CERT_EMAIL}" \
    --agree-tos --no-eff-email --non-interactive

echo "==> Certificado emitido. Recarga nginx: docker compose ... exec web nginx -s reload"
