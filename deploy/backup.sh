#!/bin/sh
set -eu

DB_HOST=${POSTGRES_HOST:-db}
DB_USER=${POSTGRES_USER:-motel}
DB_NAME=${POSTGRES_DB:-motel_erp}
RETENTION=${BACKUP_RETENTION_DAYS:-14}
INTERVAL=${BACKUP_INTERVAL_SECONDS:-86400}

echo "Respaldos cada ${INTERVAL}s, conservando ${RETENTION} días."

while true; do
    sello=$(date -u +%Y%m%d-%H%M%S)
    parcial="/backups/.parcial-${sello}.sql"
    final="/backups/motel_erp-${sello}.sql.gz"

    if pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > "$parcial" && gzip "$parcial"; then
        mv "${parcial}.gz" "$final"
        echo "$(date -u +%FT%TZ) respaldo OK: ${final} ($(wc -c < "$final") bytes)"
        find /backups -name 'motel_erp-*.sql.gz' -mtime "+${RETENTION}" -delete \
            || echo "$(date -u +%FT%TZ) AVISO: no se pudieron podar los respaldos viejos" >&2
    else
        rm -f "$parcial" "${parcial}.gz"
        echo "$(date -u +%FT%TZ) RESPALDO FALLIDO: la base no respondió o el disco está lleno" >&2
    fi

    sleep "$INTERVAL"
done
