#!/bin/sh
# Certificado provisional para que nginx pueda arrancar la primera vez.
#
# Es un empate: nginx no levanta si ssl_certificate apunta a un archivo que no
# existe, y certbot no puede pedir el certificado bueno si nginx no esta arriba
# para contestar el reto de ACME en el puerto 80. Un autofirmado lo rompe. El
# navegador lo va a rechazar -- eso se espera y dura lo que tarde la primera
# emision -- pero el puerto 80 queda sirviendo /.well-known y con eso certbot
# ya puede trabajar.
#
# Deja una marca .provisional. issue-cert.sh solo retira el certificado si
# encuentra esa marca, de modo que la primera emision nunca pueda destruir un
# certificado real.
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
