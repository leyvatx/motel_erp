import django.db.models.deletion
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_initial'),
        ('settings', '0004_alter_motel_managers'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='notification',
            options={'base_manager_name': 'all_objects', 'ordering': ['-created_at'], 'verbose_name': 'Notificación', 'verbose_name_plural': 'Notificaciones'},
        ),
        migrations.AddField(
            model_name='notification',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AlterField(
            model_name='notification',
            name='category',
            field=models.CharField(choices=[('STAY_EXPIRING', 'Renta por vencer'), ('STAY_EXPIRED', 'Renta vencida'), ('LOW_STOCK', 'Stock mínimo'), ('EXPIRING_LOT', 'Producto por caducar'), ('NEW_ORDER', 'Nueva orden'), ('CLEANING_TASK', 'Tarea de limpieza'), ('MAINTENANCE', 'Mantenimiento'), ('EXPENSE_APPROVAL', 'Gasto por aprobar'), ('SHIFT', 'Turno de caja')], db_index=True, max_length=20, verbose_name='Categoría'),
        ),
    ]
