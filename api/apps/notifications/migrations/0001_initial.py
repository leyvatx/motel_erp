import django.db.models.manager
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('category', models.CharField(choices=[('STAY_EXPIRING', 'Renta por vencer'), ('STAY_EXPIRED', 'Renta vencida'), ('LOW_STOCK', 'Stock minimo'), ('EXPIRING_LOT', 'Producto por caducar'), ('NEW_ORDER', 'Nueva orden'), ('CLEANING_TASK', 'Tarea de limpieza'), ('MAINTENANCE', 'Mantenimiento'), ('EXPENSE_APPROVAL', 'Gasto por aprobar'), ('SHIFT', 'Turno de caja')], db_index=True, max_length=20, verbose_name='Categoria')),
                ('level', models.CharField(choices=[('INFO', 'Informativa'), ('WARNING', 'Advertencia'), ('CRITICAL', 'Critica')], default='INFO', max_length=10, verbose_name='Nivel')),
                ('title', models.CharField(max_length=120, verbose_name='Titulo')),
                ('body', models.CharField(blank=True, max_length=255, verbose_name='Mensaje')),
                ('target_role', models.CharField(blank=True, db_index=True, help_text='Vacio = todos los roles.', max_length=20, verbose_name='Rol destino')),
                ('payload', models.JSONField(blank=True, default=dict, verbose_name='Datos')),
                ('read_at', models.DateTimeField(blank=True, null=True, verbose_name='Leida en')),
            ],
            options={
                'verbose_name': 'Notificacion',
                'verbose_name_plural': 'Notificaciones',
                'ordering': ['-created_at'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
    ]
