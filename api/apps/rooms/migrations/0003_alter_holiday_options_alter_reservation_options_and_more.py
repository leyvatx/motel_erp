import django.contrib.postgres.fields
import django.core.validators
import django.db.models.deletion
import django.db.models.manager
import django.utils.timezone
from decimal import Decimal
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0002_initial'),
        ('settings', '0004_alter_motel_managers'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='holiday',
            options={'base_manager_name': 'all_objects', 'ordering': ['date'], 'verbose_name': 'Día festivo', 'verbose_name_plural': 'Días festivos'},
        ),
        migrations.AlterModelOptions(
            name='reservation',
            options={'base_manager_name': 'all_objects', 'ordering': ['scheduled_start'], 'verbose_name': 'Reservación', 'verbose_name_plural': 'Reservaciones'},
        ),
        migrations.AlterModelOptions(
            name='room',
            options={'base_manager_name': 'all_objects', 'ordering': ['floor', 'number'], 'verbose_name': 'Habitación', 'verbose_name_plural': 'Habitaciones'},
        ),
        migrations.AlterModelOptions(
            name='roomstatuslog',
            options={'ordering': ['-created_at'], 'verbose_name': 'Cambio de estado de habitación', 'verbose_name_plural': 'Cambios de estado de habitación'},
        ),
        migrations.AlterModelOptions(
            name='roomtype',
            options={'base_manager_name': 'all_objects', 'ordering': ['sort_order', 'name'], 'verbose_name': 'Tipo de habitación', 'verbose_name_plural': 'Tipos de habitación'},
        ),
        migrations.AlterModelOptions(
            name='stayextension',
            options={'base_manager_name': 'all_objects', 'ordering': ['-created_at'], 'verbose_name': 'Extensión de renta', 'verbose_name_plural': 'Extensiones de renta'},
        ),
        migrations.AlterModelManagers(
            name='roomstatuslog',
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.AddField(
            model_name='holiday',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='reservation',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='room',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='roomstatuslog',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='roomtype',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='stay',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='stayextension',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='tariffblock',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='tariffrule',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AlterField(
            model_name='reservation',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='reservation',
            name='guest_phone',
            field=models.CharField(blank=True, max_length=20, verbose_name='Teléfono'),
        ),
        migrations.AlterField(
            model_name='reservation',
            name='room',
            field=models.ForeignKey(blank=True, help_text='Opcional: si se deja vacio se asigna al hacer check-in.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reservations', to='rooms.room', verbose_name='Habitación'),
        ),
        migrations.AlterField(
            model_name='reservation',
            name='room_type',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='reservations', to='rooms.roomtype', verbose_name='Tipo de habitación'),
        ),
        migrations.AlterField(
            model_name='room',
            name='number',
            field=models.CharField(db_index=True, max_length=10, verbose_name='Número'),
        ),
        migrations.AlterField(
            model_name='room',
            name='status',
            field=models.CharField(choices=[('AVAILABLE', 'Disponible'), ('RESERVED', 'Reservada'), ('OCCUPIED', 'Ocupada'), ('CLEANING', 'En limpieza'), ('MAINTENANCE', 'En mantenimiento'), ('BLOCKED', 'Fuera de servicio')], db_index=True, default='AVAILABLE', help_text='Solo debe modificarse mediante la máquina de estados.', max_length=15, verbose_name='Estado'),
        ),
        migrations.AlterField(
            model_name='room',
            name='status_changed_at',
            field=models.DateTimeField(default=django.utils.timezone.now, editable=False, verbose_name='Último cambio de estado'),
        ),
        migrations.AlterField(
            model_name='roomstatuslog',
            name='room',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='status_logs', to='rooms.room', verbose_name='Habitación'),
        ),
        migrations.AlterField(
            model_name='roomtype',
            name='description',
            field=models.TextField(blank=True, verbose_name='Descripción'),
        ),
        migrations.AlterField(
            model_name='roomtype',
            name='max_occupants',
            field=models.PositiveSmallIntegerField(default=2, verbose_name='Ocupantes máximos'),
        ),
        migrations.AlterField(
            model_name='stay',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='stay',
            name='reservation',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='stay', to='rooms.reservation', verbose_name='Reservación origen'),
        ),
        migrations.AlterField(
            model_name='stay',
            name='room',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='stays', to='rooms.room', verbose_name='Habitación'),
        ),
        migrations.AlterField(
            model_name='stay',
            name='vehicle_description',
            field=models.CharField(blank=True, max_length=80, verbose_name='Vehículo'),
        ),
        migrations.AlterField(
            model_name='stayextension',
            name='is_overstay_surcharge',
            field=models.BooleanField(default=False, help_text='Se marca cuando la extensión la genera el sistema por sobreestadia.', verbose_name='Es recargo por tiempo excedido'),
        ),
        migrations.AlterField(
            model_name='tariffblock',
            name='duration_minutes',
            field=models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(1)], verbose_name='Duración (minutos)'),
        ),
        migrations.AlterField(
            model_name='tariffblock',
            name='overstay_hour_price',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Se cobra por cada hora iniciada después de la tolerancia.', max_digits=10, verbose_name='Recargo por hora extra'),
        ),
        migrations.AlterField(
            model_name='tariffblock',
            name='room_type',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='tariff_blocks', to='rooms.roomtype', verbose_name='Tipo de habitación'),
        ),
        migrations.AlterField(
            model_name='tariffrule',
            name='priority',
            field=models.PositiveSmallIntegerField(default=100, help_text='Mayor número gana.', verbose_name='Prioridad'),
        ),
        migrations.AlterField(
            model_name='tariffrule',
            name='rule_type',
            field=models.CharField(choices=[('WEEKDAY', 'Días de la semana'), ('DATE_RANGE', 'Rango de fechas'), ('HOLIDAY', 'Día festivo')], max_length=15, verbose_name='Tipo'),
        ),
        migrations.AlterField(
            model_name='tariffrule',
            name='value',
            field=models.DecimalField(decimal_places=2, help_text='Precio fijo, factor multiplicador o monto adicional según el modo.', max_digits=10, verbose_name='Valor'),
        ),
        migrations.AlterField(
            model_name='tariffrule',
            name='weekdays',
            field=django.contrib.postgres.fields.ArrayField(base_field=models.PositiveSmallIntegerField(), blank=True, default=list, help_text='0=lunes ... 6=domingo. Solo para reglas de tipo WEEKDAY.', size=None, verbose_name='Días de la semana'),
        ),
    ]
