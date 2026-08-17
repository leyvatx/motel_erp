"""Pone al día el contador de llaves de la tabla de moteles.

El primer motel se sembró con una llave explicita, así que la secuencia de
Postgres se quedó en cero y el siguiente alta habria intentado reutilizar ese
mismo número. En una base recien creada la instrucción no cambia nada.
"""

from django.db import migrations

FIX_SEQUENCE = """
SELECT setval(
    pg_get_serial_sequence('settings_motel', 'id'),
    COALESCE((SELECT MAX(id) FROM settings_motel), 1)
);
"""


class Migration(migrations.Migration):
    dependencies = [("settings", "0005_backfill_motel")]

    operations = [migrations.RunSQL(FIX_SEQUENCE, migrations.RunSQL.noop)]
