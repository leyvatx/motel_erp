import apps.settings.models
import django.core.validators
import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BusinessProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('name', models.CharField(default='Motel', max_length=120, verbose_name='Nombre comercial')),
                ('legal_name', models.CharField(blank=True, max_length=160, verbose_name='Razón social')),
                ('tax_id', models.CharField(blank=True, max_length=20, verbose_name='RFC')),
                ('address', models.CharField(blank=True, max_length=255, verbose_name='Dirección')),
                ('phone', models.CharField(blank=True, max_length=30, verbose_name='Teléfono')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='Correo')),
                ('logo', models.FileField(blank=True, help_text='Se usa en el menú, en la pantalla de acceso y como icono de la pestaña.', upload_to='branding/', validators=[django.core.validators.FileExtensionValidator(['png', 'jpg', 'jpeg', 'webp'])], verbose_name='Logotipo')),
                ('currency', models.CharField(default='MXN', max_length=3, verbose_name='Moneda')),
                ('locale', models.CharField(default='es-MX', max_length=10, verbose_name='Formato regional')),
                ('time_zone', models.CharField(default='America/Mexico_City', help_text='Define el corte del día de operación. El servidor sigue guardando en UTC.', max_length=64, validators=[apps.settings.models.validate_time_zone], verbose_name='Zona horaria')),
                ('ticket_footer', models.CharField(blank=True, default='Gracias por su visita', max_length=160, verbose_name='Pie del ticket')),
                ('print_ticket_on_close', models.BooleanField(default=True, verbose_name='Imprimir al cerrar la cuenta')),
                ('expiration_warning_minutes', models.PositiveSmallIntegerField(default=15, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(240)], verbose_name='Antelación del aviso de vencimiento (min)')),
                ('expense_approval_threshold', models.DecimalField(decimal_places=2, default=Decimal('1000.00'), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))], verbose_name='Gasto que requiere aprobación')),
                ('printer_backend', models.CharField(choices=[('dummy', 'Sin impresora (solo registra)'), ('network', 'Impresora de red'), ('usb', 'Impresora USB'), ('file', 'Archivo de texto')], default='dummy', max_length=10, verbose_name='Tipo de impresora')),
                ('printer_host', models.CharField(blank=True, max_length=60, verbose_name='IP de la impresora')),
                ('printer_port', models.PositiveIntegerField(default=9100, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(65535)], verbose_name='Puerto')),
                ('created_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Creado por')),
                ('updated_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Actualizado por')),
            ],
            options={
                'verbose_name': 'Perfil del negocio',
                'verbose_name_plural': 'Perfil del negocio',
            },
        ),
    ]
