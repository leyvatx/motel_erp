#!/bin/sh
# Deja un despliegue listo para entregárselo a un cliente.
#
# Hace dos cosas en orden: retira la sucursal sembrada al instalar -- la que se
# llama "Motel Demo", "Negocio Demo" o como haya quedado -- y crea la cuenta de
# quien va a recibir el sistema, con una contraseña inventada aquí.
#
# La cadena de conexión se lee de api/.env.render y nunca se imprime. La
# contraseña generada tampoco sale a la pantalla: se escribe en un archivo que
# el script te dice al terminar. Las dos cosas están fuera de git.
#
# Uso:
#   sh scripts/entregar.sh --slug motel-demo --email admin@empresa.com \
#       --nombre "Administrador"

set -e

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
CREDENCIALES="$RAIZ/api/.env.render"
DESTINO_CLAVE="$RAIZ/api/.clave-cliente.txt"
PYTHON="$RAIZ/api/.venv/Scripts/python.exe"
[ -x "$PYTHON" ] || PYTHON="$RAIZ/api/.venv/bin/python"

SLUG=""
EMAIL=""
NOMBRE="Administrador"

while [ $# -gt 0 ]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --nombre) NOMBRE="$2"; shift 2 ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$SLUG" ] || [ -z "$EMAIL" ]; then
  echo "Faltan datos. Ejemplo:" >&2
  echo "  sh scripts/entregar.sh --slug motel-demo --email admin@empresa.com" >&2
  exit 2
fi

if [ ! -f "$CREDENCIALES" ]; then
  echo "No encuentro $CREDENCIALES." >&2
  echo "Crea ese archivo con una sola línea:" >&2
  echo "  DATABASE_URL=postgresql://..." >&2
  exit 1
fi

# La cadena entra al entorno de los comandos y no se muestra en ningún momento.
DATABASE_URL=$(grep '^DATABASE_URL=' "$CREDENCIALES" | head -1 | cut -d= -f2-)
if [ -z "$DATABASE_URL" ]; then
  echo "$CREDENCIALES no tiene una línea DATABASE_URL=..." >&2
  exit 1
fi
export DATABASE_URL

DESTINO=$(printf '%s' "$DATABASE_URL" | sed -E 's#.*@([^/]+)/.*#\1#')
echo "Base de datos: $DESTINO"
echo

cd "$RAIZ/api"

echo "── Paso 1 de 3: qué se va a retirar ────────────────────────────────"
"$PYTHON" manage.py reset_tenant --slug "$SLUG" --retirar
echo

printf "¿Retiro esa sucursal? Escribe SI en mayúsculas para continuar: "
read -r RESPUESTA
[ "$RESPUESTA" = "SI" ] || { echo "Cancelado. No se tocó nada."; exit 0; }

echo
echo "── Paso 2 de 3: retirando ──────────────────────────────────────────"
"$PYTHON" manage.py reset_tenant --slug "$SLUG" --retirar --si

echo
echo "── Paso 3 de 3: creando la cuenta del cliente ──────────────────────"
# La salida completa va al archivo, y a la pantalla solo lo que no es secreto.
"$PYTHON" manage.py create_client_admin \
  --email "$EMAIL" --nombre "$NOMBRE" --generar-clave > "$DESTINO_CLAVE"

grep -v 'Contraseña:' "$DESTINO_CLAVE" || true

echo
echo "La contraseña quedó en:"
echo "  $DESTINO_CLAVE"
echo
echo "Ábrelo, cópiala al canal por el que se la vas a entregar al cliente, y"
echo "borra el archivo. No se puede volver a mostrar."
