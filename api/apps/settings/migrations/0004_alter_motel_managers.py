import django.db.models.manager
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('settings', '0003_motel'),
    ]

    operations = [
        migrations.AlterModelManagers(
            name='motel',
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
    ]
