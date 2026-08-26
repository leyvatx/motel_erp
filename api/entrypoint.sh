#!/bin/sh
set -e

# En Render free el contenedor se apaga a los 15 min y vuelve a pasar por aquí
# entero al despertar, con 0.1 de CPU. Cada `manage.py` cuesta un arranque
# completo de Django, así que los de siempre van en un solo proceso en vez de
# dos, y collectstatic ya no va: sale horneado en la imagen desde el Dockerfile.

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "==> Migrando base de datos y verificando la cuenta de plataforma"
  python - <<'PY'
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.core.management import call_command

call_command("migrate", interactive=False)
call_command("ensure_platform_admin")
PY
fi

if [ "${RUN_COLLECTSTATIC:-0}" = "1" ]; then
  echo "==> Recolectando archivos estáticos"
  python manage.py collectstatic --noinput
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ] && [ "${SEED_DEMO:-0}" = "1" ]; then
  echo "==> Sembrando datos de ejemplo"
  python manage.py seed_demo || echo "AVISO: la siembra falló; el servidor arranca igual." >&2
fi

exec "$@"
