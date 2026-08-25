import django.db.models.deletion
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('common', '0001_initial'),
        ('settings', '0004_alter_motel_managers'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='documentsequence',
            name='uniq_document_sequence_key_period',
        ),
        migrations.AddField(
            model_name='documentsequence',
            name='motel',
            field=models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='settings.motel', verbose_name='Motel'),
        ),
        migrations.AddConstraint(
            model_name='documentsequence',
            constraint=models.UniqueConstraint(fields=('motel', 'key', 'period_key'), name='uniq_document_sequence_motel_key_period'),
        ),
    ]
