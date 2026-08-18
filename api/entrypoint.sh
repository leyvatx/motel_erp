#!/bin/sh
# Prepara el contenedor y cede el control al proceso que se le pidió correr.
#
# migrate y collectstatic van aquí y no en la imagen: la imagen se construye
# sin base de datos y sin la llave de firma, y ambas cosas hacen falta. Los dos
# comandos son idempotentes, así que reiniciar no rompe nada.
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "==> Migrando base de datos"
  python manage.py migrate --noinput
fi

if [ "${RUN_COLLECTSTATIC:-1}" = "1" ]; then
  echo "==> Recolectando archivos estáticos"
  python manage.py collectstatic --noinput
fi

exec "$@"
