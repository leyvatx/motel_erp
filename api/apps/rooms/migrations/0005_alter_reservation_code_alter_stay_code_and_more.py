from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0004_remove_holiday_uniq_active_holiday_date_and_more'),
        ('settings', '0007_motel_border_radius_motel_brand_primary_color_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='reservation',
            name='code',
            field=models.CharField(editable=False, max_length=25, verbose_name='Folio'),
        ),
        migrations.AlterField(
            model_name='stay',
            name='code',
            field=models.CharField(editable=False, max_length=25, verbose_name='Folio de renta'),
        ),
        migrations.AddConstraint(
            model_name='reservation',
            constraint=models.UniqueConstraint(fields=('motel', 'code'), name='uniq_reservation_code_motel'),
        ),
        migrations.AddConstraint(
            model_name='stay',
            constraint=models.UniqueConstraint(fields=('motel', 'code'), name='uniq_stay_code_motel'),
        ),
    ]
