import django.db.models.deletion
import django.db.models.manager
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('settings', '0007_motel_border_radius_motel_brand_primary_color_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MotelGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('code', models.CharField(max_length=20, verbose_name='Clave')),
                ('name', models.CharField(db_index=True, max_length=120, verbose_name='Nombre')),
                ('description', models.CharField(blank=True, max_length=255, verbose_name='Descripción')),
                ('created_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Creado por')),
                ('deleted_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Desactivado por')),
                ('updated_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Actualizado por')),
            ],
            options={
                'verbose_name': 'Grupo de moteles',
                'verbose_name_plural': 'Grupos de moteles',
                'ordering': ['name'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='MotelRegion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('code', models.CharField(max_length=20, verbose_name='Clave')),
                ('name', models.CharField(db_index=True, max_length=120, verbose_name='Nombre')),
                ('description', models.CharField(blank=True, max_length=255, verbose_name='Descripción')),
                ('created_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Creado por')),
                ('deleted_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Desactivado por')),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='regions', to='corporate.motelgroup')),
                ('updated_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Actualizado por')),
            ],
            options={
                'verbose_name': 'Región',
                'verbose_name_plural': 'Regiones',
                'ordering': ['group__name', 'name'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='CorporateAccess',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('role', models.CharField(choices=[('SUPERADMIN', 'Super administrador'), ('MANAGER', 'Gerente'), ('RECEPTION', 'Recepción'), ('HOUSEKEEPING', 'Ama de llaves')], max_length=20, verbose_name='Rol en las propiedades')),
                ('created_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Creado por')),
                ('deleted_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Desactivado por')),
                ('motel', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='corporate_accesses', to='settings.motel')),
                ('updated_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Actualizado por')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='corporate_accesses', to=settings.AUTH_USER_MODEL)),
                ('region', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='user_accesses', to='corporate.motelregion')),
            ],
            options={
                'verbose_name': 'Acceso corporativo',
                'verbose_name_plural': 'Accesos corporativos',
                'ordering': ['user__full_name'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='RegionMotel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('created_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Creado por')),
                ('deleted_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Desactivado por')),
                ('motel', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='corporate_membership', to='settings.motel')),
                ('region', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to='corporate.motelregion')),
                ('updated_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='Actualizado por')),
            ],
            options={
                'verbose_name': 'Motel de región',
                'verbose_name_plural': 'Moteles de región',
                'ordering': ['region', 'motel__name'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.AddConstraint(
            model_name='motelgroup',
            constraint=models.UniqueConstraint(condition=models.Q(('is_active', True)), fields=('code',), name='uniq_active_group_code'),
        ),
        migrations.AddConstraint(
            model_name='motelregion',
            constraint=models.UniqueConstraint(condition=models.Q(('is_active', True)), fields=('group', 'code'), name='uniq_active_region_code_group'),
        ),
        migrations.AddConstraint(
            model_name='corporateaccess',
            constraint=models.CheckConstraint(condition=models.Q(models.Q(('motel__isnull', True), ('region__isnull', False)), models.Q(('motel__isnull', False), ('region__isnull', True)), _connector='OR'), name='corporate_access_exact_scope'),
        ),
        migrations.AddConstraint(
            model_name='corporateaccess',
            constraint=models.UniqueConstraint(condition=models.Q(('is_active', True), ('region__isnull', False)), fields=('user', 'region'), name='uniq_active_user_region_access'),
        ),
        migrations.AddConstraint(
            model_name='corporateaccess',
            constraint=models.UniqueConstraint(condition=models.Q(('is_active', True), ('motel__isnull', False)), fields=('user', 'motel'), name='uniq_active_user_motel_access'),
        ),
    ]
