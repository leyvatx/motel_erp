#!/bin/sh
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
