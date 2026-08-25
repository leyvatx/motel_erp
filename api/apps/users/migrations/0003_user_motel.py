import django.db.models.deletion
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('settings', '0004_alter_motel_managers'),
        ('users', '0002_alter_user_employee_number_alter_user_last_login_ip_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='motel',
            field=models.ForeignKey(blank=True, help_text='Vacío solo para quien administra la plataforma completa.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='users', to='settings.motel', verbose_name='Motel'),
        ),
    ]
