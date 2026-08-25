from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0003_alter_holiday_options_alter_reservation_options_and_more'),
        ('settings', '0007_motel_border_radius_motel_brand_primary_color_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='holiday',
            name='uniq_active_holiday_date',
        ),
        migrations.RemoveConstraint(
            model_name='room',
            name='uniq_active_room_number',
        ),
        migrations.RemoveConstraint(
            model_name='roomtype',
            name='uniq_active_room_type_code',
        ),
        migrations.AddConstraint(
            model_name='holiday',
            constraint=models.UniqueConstraint(condition=models.Q(('is_active', True)), fields=('motel', 'date'), name='uniq_active_holiday_date'),
        ),
        migrations.AddConstraint(
            model_name='room',
            constraint=models.UniqueConstraint(condition=models.Q(('is_active', True)), fields=('motel', 'number'), name='uniq_active_room_number'),
        ),
        migrations.AddConstraint(
            model_name='roomtype',
            constraint=models.UniqueConstraint(condition=models.Q(('is_active', True)), fields=('motel', 'code'), name='uniq_active_room_type_code'),
        ),
    ]
