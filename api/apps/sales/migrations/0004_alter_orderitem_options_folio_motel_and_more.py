import django.db.models.deletion
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('finances', '0002_alter_cashmovement_managers_cashcount_motel_and_more'),
        ('inventory', '0003_alter_productcategory_options_and_more'),
        ('rooms', '0003_alter_holiday_options_alter_reservation_options_and_more'),
        ('sales', '0003_payment_shift_payment_payment_shift_status_idx'),
        ('settings', '0004_alter_motel_managers'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='orderitem',
            options={'base_manager_name': 'all_objects', 'ordering': ['id'], 'verbose_name': 'Renglón de orden', 'verbose_name_plural': 'Renglones de orden'},
        ),
        migrations.AddField(
            model_name='folio',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='foliocharge',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='order',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='payment',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddField(
            model_name='receipt',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AlterField(
            model_name='folio',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='folio',
            name='folio_type',
            field=models.CharField(choices=[('ROOM', 'Cuenta de habitación'), ('COUNTER', 'Venta de mostrador')], default='ROOM', max_length=10, verbose_name='Tipo'),
        ),
        migrations.AlterField(
            model_name='folio',
            name='room',
            field=models.ForeignKey(blank=True, help_text='Copia denormalizada para el buscador global y los reportes.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='folios', to='rooms.room', verbose_name='Habitación'),
        ),
        migrations.AlterField(
            model_name='foliocharge',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='foliocharge',
            name='charge_type',
            field=models.CharField(choices=[('ROOM_RENT', 'Renta de habitación'), ('EXTENSION', 'Extensión de tiempo'), ('OVERSTAY', 'Recargo por tiempo excedido'), ('EXTRA_PERSON', 'Persona adicional'), ('PRODUCTS', 'Consumo de productos'), ('SERVICE', 'Servicio'), ('SURCHARGE', 'Recargo'), ('DISCOUNT', 'Descuento'), ('ADJUSTMENT', 'Ajuste')], max_length=15, verbose_name='Concepto'),
        ),
        migrations.AlterField(
            model_name='foliocharge',
            name='description',
            field=models.CharField(max_length=180, verbose_name='Descripción'),
        ),
        migrations.AlterField(
            model_name='foliocharge',
            name='stay_extension',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='charge', to='rooms.stayextension', verbose_name='Extensión origen'),
        ),
        migrations.AlterField(
            model_name='order',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='order',
            name='code',
            field=models.CharField(editable=False, max_length=25, unique=True, verbose_name='Número de orden'),
        ),
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(choices=[('DRAFT', 'Borrador'), ('PLACED', 'Solicitada'), ('PREPARING', 'En preparación'), ('DELIVERED', 'Entregada'), ('CANCELLED', 'Cancelada')], db_index=True, default='PLACED', max_length=12, verbose_name='Estado'),
        ),
        migrations.AlterField(
            model_name='order',
            name='warehouse',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='orders', to='inventory.warehouse', verbose_name='Almacén de descarga'),
        ),
        migrations.AlterField(
            model_name='orderitem',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='orderitem',
            name='description',
            field=models.CharField(max_length=180, verbose_name='Descripción'),
        ),
        migrations.AlterField(
            model_name='payment',
            name='method',
            field=models.CharField(choices=[('CASH', 'Efectivo'), ('CARD', 'Tarjeta'), ('TRANSFER', 'Transferencia'), ('COURTESY', 'Cortesia')], db_index=True, max_length=10, verbose_name='Método'),
        ),
        migrations.AlterField(
            model_name='payment',
            name='reference',
            field=models.CharField(blank=True, help_text='Autorización, últimos 4 digitos, folio.', max_length=60, verbose_name='Referencia'),
        ),
        migrations.AlterField(
            model_name='payment',
            name='shift',
            field=models.ForeignKey(blank=True, help_text='Turno en el que se cobró. Es la base del corte de caja.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='payments', to='finances.shift', verbose_name='Turno de caja'),
        ),
        migrations.AlterField(
            model_name='payment',
            name='void_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelación'),
        ),
        migrations.AlterField(
            model_name='receipt',
            name='error_message',
            field=models.CharField(blank=True, max_length=255, verbose_name='Error de impresión'),
        ),
        migrations.AlterField(
            model_name='receipt',
            name='kind',
            field=models.CharField(choices=[('ROOM_TICKET', 'Ticket de habitación'), ('COUNTER_TICKET', 'Ticket de mostrador'), ('ORDER_TICKET', 'Comanda'), ('SHIFT_REPORT', 'Corte de turno')], max_length=16, verbose_name='Tipo'),
        ),
    ]
