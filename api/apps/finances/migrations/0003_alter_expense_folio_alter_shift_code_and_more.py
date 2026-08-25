from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('finances', '0002_alter_cashmovement_managers_cashcount_motel_and_more'),
        ('settings', '0007_motel_border_radius_motel_brand_primary_color_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='expense',
            name='folio',
            field=models.CharField(editable=False, max_length=25, verbose_name='Folio'),
        ),
        migrations.AlterField(
            model_name='shift',
            name='code',
            field=models.CharField(editable=False, max_length=25, verbose_name='Folio de turno'),
        ),
        migrations.AddConstraint(
            model_name='expense',
            constraint=models.UniqueConstraint(fields=('motel', 'folio'), name='uniq_expense_folio_motel'),
        ),
        migrations.AddConstraint(
            model_name='shift',
            constraint=models.UniqueConstraint(fields=('motel', 'code'), name='uniq_shift_code_motel'),
        ),
    ]
