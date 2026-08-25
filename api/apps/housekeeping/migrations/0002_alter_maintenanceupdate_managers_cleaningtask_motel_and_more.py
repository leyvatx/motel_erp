import django.db.models.deletion
import django.db.models.manager
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('housekeeping', '0001_initial'),
        ('rooms', '0003_alter_holiday_options_alter_reservation_options_and_more'),
        ('settings', '0004_alter_motel_managers'),
    ]

    operations = [
        migrations.AlterModelManagers(
            name='maintenanceupdate',
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.AddField(
            model_name='cleaningtask',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='maintenancereport',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='maintenanceupdate',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AlterField(
            model_name='cleaningtask',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='cleaningtask',
            name='duration_seconds',
            field=models.PositiveIntegerField(blank=True, editable=False, null=True, verbose_name='Duración (segundos)'),
        ),
        migrations.AlterField(
            model_name='cleaningtask',
            name='priority',
            field=models.PositiveSmallIntegerField(default=100, help_text='Menor número se atiende primero.', verbose_name='Prioridad'),
        ),
        migrations.AlterField(
            model_name='cleaningtask',
            name='room',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='cleaning_tasks', to='rooms.room', verbose_name='Habitación'),
        ),
        migrations.AlterField(
            model_name='cleaningtask',
            name='stay',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='cleaning_tasks', to='rooms.stay', verbose_name='Renta que la originó'),
        ),
        migrations.AlterField(
            model_name='maintenancereport',
            name='blocks_room',
            field=models.BooleanField(default=False, help_text='Si se marca, la habitación pasa a mantenimiento hasta resolverse.', verbose_name='Deja la habitación fuera de servicio'),
        ),
        migrations.AlterField(
            model_name='maintenancereport',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='maintenancereport',
            name='category',
            field=models.CharField(choices=[('PLUMBING', 'Plomería'), ('ELECTRICAL', 'Electricidad'), ('AIR_CONDITIONING', 'Clima'), ('FURNITURE', 'Mobiliario'), ('ELECTRONICS', 'Televisión / electrónicos'), ('STRUCTURE', 'Obra civil'), ('OTHER', 'Otro')], default='OTHER', max_length=20, verbose_name='Categoría'),
        ),
        migrations.AlterField(
            model_name='maintenancereport',
            name='description',
            field=models.TextField(verbose_name='Descripción'),
        ),
        migrations.AlterField(
            model_name='maintenancereport',
            name='resolution_notes',
            field=models.TextField(blank=True, verbose_name='Notas de resolución'),
        ),
        migrations.AlterField(
            model_name='maintenancereport',
            name='room',
            field=models.ForeignKey(blank=True, help_text='Vacio si el reporte es de un área común.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='maintenance_reports', to='rooms.room', verbose_name='Habitación'),
        ),
        migrations.AlterField(
            model_name='maintenancereport',
            name='status',
            field=models.CharField(choices=[('REPORTED', 'Reportado'), ('ACKNOWLEDGED', 'Recibido'), ('IN_PROGRESS', 'En atención'), ('RESOLVED', 'Resuelto'), ('CANCELLED', 'Cancelado')], db_index=True, default='REPORTED', max_length=14, verbose_name='Estado'),
        ),
        migrations.AlterField(
            model_name='maintenanceupdate',
            name='status_after',
            field=models.CharField(choices=[('REPORTED', 'Reportado'), ('ACKNOWLEDGED', 'Recibido'), ('IN_PROGRESS', 'En atención'), ('RESOLVED', 'Resuelto'), ('CANCELLED', 'Cancelado')], max_length=14, verbose_name='Estado nuevo'),
        ),
        migrations.AlterField(
            model_name='maintenanceupdate',
            name='status_before',
            field=models.CharField(choices=[('REPORTED', 'Reportado'), ('ACKNOWLEDGED', 'Recibido'), ('IN_PROGRESS', 'En atención'), ('RESOLVED', 'Resuelto'), ('CANCELLED', 'Cancelado')], max_length=14, verbose_name='Estado anterior'),
        ),
    ]
