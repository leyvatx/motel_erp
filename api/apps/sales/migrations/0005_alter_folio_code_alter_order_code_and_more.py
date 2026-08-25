from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_purchaseorder_purchaseorderitem_supplier_and_more'),
        ('rooms', '0005_alter_reservation_code_alter_stay_code_and_more'),
        ('sales', '0004_alter_orderitem_options_folio_motel_and_more'),
        ('settings', '0007_motel_border_radius_motel_brand_primary_color_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='folio',
            name='code',
            field=models.CharField(editable=False, max_length=25, verbose_name='Folio'),
        ),
        migrations.AlterField(
            model_name='order',
            name='code',
            field=models.CharField(editable=False, max_length=25, verbose_name='Número de orden'),
        ),
        migrations.AddConstraint(
            model_name='folio',
            constraint=models.UniqueConstraint(fields=('motel', 'code'), name='uniq_folio_code_motel'),
        ),
        migrations.AddConstraint(
            model_name='order',
            constraint=models.UniqueConstraint(fields=('motel', 'code'), name='uniq_order_code_motel'),
        ),
    ]
