import django.db.models.deletion
import django.db.models.manager
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('rooms', '0002_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CleaningTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('task_type', models.CharField(choices=[('CHECKOUT', 'Salida de huesped'), ('PREVENTIVE', 'Mantenimiento preventivo'), ('DEEP', 'Limpieza profunda'), ('INSPECTION', 'Inspeccion')], default='CHECKOUT', max_length=12, verbose_name='Tipo')),
                ('status', models.CharField(choices=[('PENDING', 'Pendiente'), ('ASSIGNED', 'Asignada'), ('IN_PROGRESS', 'En proceso'), ('DONE', 'Terminada'), ('VERIFIED', 'Verificada'), ('CANCELLED', 'Cancelada')], db_index=True, default='PENDING', max_length=12, verbose_name='Estado')),
                ('priority', models.PositiveSmallIntegerField(default=100, help_text='Menor numero se atiende primero.', verbose_name='Prioridad')),
                ('assigned_at', models.DateTimeField(blank=True, null=True, verbose_name='Asignada en')),
                ('started_at', models.DateTimeField(blank=True, null=True, verbose_name='Iniciada en')),
                ('finished_at', models.DateTimeField(blank=True, null=True, verbose_name='Terminada en')),
                ('duration_seconds', models.PositiveIntegerField(blank=True, editable=False, null=True, verbose_name='Duracion (segundos)')),
                ('verified_at', models.DateTimeField(blank=True, null=True, verbose_name='Verificada en')),
                ('notes', models.TextField(blank=True, verbose_name='Notas')),
                ('found_issues', models.BooleanField(default=False, verbose_name='Reporto incidencias')),
                ('cancellation_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelacion')),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='cleaning_tasks', to=settings.AUTH_USER_MODEL, verbose_name='Asignada a')),
                ('created_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Creado por')),
                ('deleted_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Desactivado por')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='cleaning_tasks', to='rooms.room', verbose_name='Habitacion')),
                ('stay', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='cleaning_tasks', to='rooms.stay', verbose_name='Renta que la origino')),
                ('updated_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Actualizado por')),
                ('verified_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='verified_cleaning_tasks', to=settings.AUTH_USER_MODEL, verbose_name='Verificada por')),
            ],
            options={
                'verbose_name': 'Tarea de limpieza',
                'verbose_name_plural': 'Tareas de limpieza',
                'ordering': ['priority', 'created_at'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='MaintenanceReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('folio', models.CharField(editable=False, max_length=25, unique=True, verbose_name='Folio')),
                ('area', models.CharField(blank=True, max_length=80, verbose_name='Area')),
                ('title', models.CharField(max_length=120, verbose_name='Titulo')),
                ('description', models.TextField(verbose_name='Descripcion')),
                ('category', models.CharField(choices=[('PLUMBING', 'Plomeria'), ('ELECTRICAL', 'Electricidad'), ('AIR_CONDITIONING', 'Clima'), ('FURNITURE', 'Mobiliario'), ('ELECTRONICS', 'Television / electronicos'), ('STRUCTURE', 'Obra civil'), ('OTHER', 'Otro')], default='OTHER', max_length=20, verbose_name='Categoria')),
                ('priority', models.CharField(choices=[('LOW', 'Baja'), ('MEDIUM', 'Media'), ('HIGH', 'Alta'), ('URGENT', 'Urgente')], db_index=True, default='MEDIUM', max_length=8, verbose_name='Prioridad')),
                ('status', models.CharField(choices=[('REPORTED', 'Reportado'), ('ACKNOWLEDGED', 'Recibido'), ('IN_PROGRESS', 'En atencion'), ('RESOLVED', 'Resuelto'), ('CANCELLED', 'Cancelado')], db_index=True, default='REPORTED', max_length=14, verbose_name='Estado')),
                ('blocks_room', models.BooleanField(default=False, help_text='Si se marca, la habitacion pasa a mantenimiento hasta resolverse.', verbose_name='Deja la habitacion fuera de servicio')),
                ('resolved_at', models.DateTimeField(blank=True, null=True, verbose_name='Resuelto en')),
                ('resolution_notes', models.TextField(blank=True, verbose_name='Notas de resolucion')),
                ('cost', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12, verbose_name='Costo')),
                ('cancellation_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de cancelacion')),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='assigned_maintenance', to=settings.AUTH_USER_MODEL, verbose_name='Asignado a')),
                ('cleaning_task', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='maintenance_reports', to='housekeeping.cleaningtask', verbose_name='Detectado durante la limpieza')),
                ('created_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Creado por')),
                ('deleted_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Desactivado por')),
                ('reported_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='maintenance_reports', to=settings.AUTH_USER_MODEL, verbose_name='Reportado por')),
                ('resolved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='resolved_maintenance', to=settings.AUTH_USER_MODEL, verbose_name='Resuelto por')),
                ('room', models.ForeignKey(blank=True, help_text='Vacio si el reporte es de un area comun.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='maintenance_reports', to='rooms.room', verbose_name='Habitacion')),
                ('updated_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Actualizado por')),
            ],
            options={
                'verbose_name': 'Reporte de mantenimiento',
                'verbose_name_plural': 'Reportes de mantenimiento',
                'ordering': ['-created_at'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='MaintenanceUpdate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('note', models.TextField(verbose_name='Nota')),
                ('status_before', models.CharField(choices=[('REPORTED', 'Reportado'), ('ACKNOWLEDGED', 'Recibido'), ('IN_PROGRESS', 'En atencion'), ('RESOLVED', 'Resuelto'), ('CANCELLED', 'Cancelado')], max_length=14, verbose_name='Estado anterior')),
                ('status_after', models.CharField(choices=[('REPORTED', 'Reportado'), ('ACKNOWLEDGED', 'Recibido'), ('IN_PROGRESS', 'En atencion'), ('RESOLVED', 'Resuelto'), ('CANCELLED', 'Cancelado')], max_length=14, verbose_name='Estado nuevo')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='maintenance_updates', to=settings.AUTH_USER_MODEL, verbose_name='Registrado por')),
                ('report', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='updates', to='housekeeping.maintenancereport', verbose_name='Reporte')),
            ],
            options={
                'verbose_name': 'Seguimiento de mantenimiento',
                'verbose_name_plural': 'Seguimientos de mantenimiento',
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='cleaningtask',
            index=models.Index(fields=['status', 'priority'], name='cleaning_status_priority_idx'),
        ),
        migrations.AddIndex(
            model_name='cleaningtask',
            index=models.Index(fields=['assigned_to', 'status'], name='cleaning_assignee_idx'),
        ),
        migrations.AddIndex(
            model_name='cleaningtask',
            index=models.Index(fields=['-finished_at'], name='cleaning_finished_idx'),
        ),
        migrations.AddConstraint(
            model_name='cleaningtask',
            constraint=models.UniqueConstraint(condition=models.Q(('status__in', ['PENDING', 'ASSIGNED', 'IN_PROGRESS'])), fields=('room',), name='uniq_open_cleaning_task_per_room'),
        ),
        migrations.AddIndex(
            model_name='maintenancereport',
            index=models.Index(fields=['status', 'priority'], name='maint_status_priority_idx'),
        ),
        migrations.AddIndex(
            model_name='maintenancereport',
            index=models.Index(fields=['room', 'status'], name='maint_room_status_idx'),
        ),
        migrations.AddIndex(
            model_name='maintenanceupdate',
            index=models.Index(fields=['report', 'created_at'], name='maint_update_report_idx'),
        ),
    ]
