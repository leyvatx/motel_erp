#!/bin/sh
# Primera emision del certificado real de Let's Encrypt.
#
# Retira el autofirmado unicamente si trae la marca que le puso
# bootstrap-cert.sh: asi este script no puede borrar un certificado bueno por
# mas veces que se corra. Las renovaciones posteriores no pasan por aqui, las
# hace el servicio certbot cada doce horas.
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
