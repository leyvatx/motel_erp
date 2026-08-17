import django.core.validators
import django.db.models.manager
import django.utils.timezone
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Product',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('sku', models.CharField(db_index=True, max_length=30, verbose_name='SKU')),
                ('barcode', models.CharField(blank=True, db_index=True, max_length=40, verbose_name='Codigo de barras')),
                ('name', models.CharField(db_index=True, max_length=120, verbose_name='Nombre')),
                ('unit', models.CharField(choices=[('PIECE', 'Pieza'), ('PACK', 'Paquete'), ('BOX', 'Caja'), ('LITER', 'Litro'), ('MILLILITER', 'Mililitro'), ('KILOGRAM', 'Kilogramo'), ('GRAM', 'Gramo'), ('SERVICE', 'Servicio')], default='PIECE', max_length=12, verbose_name='Unidad')),
                ('is_sellable', models.BooleanField(default=True, verbose_name='Se vende al huesped')),
                ('is_stockable', models.BooleanField(default=True, help_text='Los servicios (p. ej. lavanderia) no descuentan inventario.', verbose_name='Controla existencias')),
                ('track_expiration', models.BooleanField(default=False, verbose_name='Controla caducidad')),
                ('sale_price', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal('0.00'))], verbose_name='Precio de venta')),
                ('last_cost', models.DecimalField(decimal_places=4, default=Decimal('0.00'), max_digits=10, verbose_name='Ultimo costo')),
                ('average_cost', models.DecimalField(decimal_places=4, default=Decimal('0.00'), max_digits=10, verbose_name='Costo promedio')),
                ('tax_rate', models.DecimalField(decimal_places=4, default=Decimal('0.00'), help_text='0.16 para IVA 16%.', max_digits=5, verbose_name='Tasa de impuesto')),
                ('default_min_stock', models.DecimalField(decimal_places=3, default=Decimal('0.00'), max_digits=12, verbose_name='Stock minimo sugerido')),
            ],
            options={
                'verbose_name': 'Producto',
                'verbose_name_plural': 'Productos',
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
            name='ProductCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('name', models.CharField(max_length=60, verbose_name='Nombre')),
                ('kind', models.CharField(choices=[('FOOD', 'Alimentos'), ('BEVERAGE', 'Bebidas'), ('CLEANING', 'Articulos de limpieza'), ('LINEN', 'Blancos'), ('AMENITY', 'Amenidades'), ('SHOP', 'Tienda / sex shop'), ('OTHER', 'Otros')], default='OTHER', max_length=15, verbose_name='Familia')),
                ('description', models.CharField(blank=True, max_length=255, verbose_name='Descripcion')),
                ('sort_order', models.PositiveSmallIntegerField(default=0, verbose_name='Orden')),
            ],
            options={
                'verbose_name': 'Categoria de producto',
                'verbose_name_plural': 'Categorias de producto',
                'ordering': ['kind', 'sort_order', 'name'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='StockLot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('lot_code', models.CharField(blank=True, max_length=40, verbose_name='Lote')),
                ('expiration_date', models.DateField(blank=True, db_index=True, null=True, verbose_name='Caducidad')),
                ('quantity', models.DecimalField(decimal_places=3, max_digits=14, verbose_name='Existencia del lote')),
                ('unit_cost', models.DecimalField(decimal_places=4, default=Decimal('0.00'), max_digits=10, verbose_name='Costo unitario')),
                ('received_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Recibido en')),
                ('expiry_notified_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Alerta de caducidad enviada')),
            ],
            options={
                'verbose_name': 'Lote',
                'verbose_name_plural': 'Lotes',
                'ordering': ['expiration_date', 'received_at'],
                'abstract': False,
                'base_manager_name': 'all_objects',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_objects', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='StockMovement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('movement_type', models.CharField(choices=[('PURCHASE', 'Compra'), ('RETURN_IN', 'Devolucion de cliente'), ('TRANSFER_IN', 'Traspaso recibido'), ('ADJUSTMENT_IN', 'Ajuste positivo'), ('INITIAL', 'Inventario inicial'), ('SALE', 'Venta'), ('CONSUMPTION', 'Consumo interno'), ('WASTE', 'Merma'), ('EXPIRED', 'Caducidad'), ('TRANSFER_OUT', 'Traspaso enviado'), ('ADJUSTMENT_OUT', 'Ajuste negativo'), ('RETURN_OUT', 'Devolucion a proveedor')], db_index=True, max_length=15, verbose_name='Tipo de movimiento')),
                ('quantity', models.DecimalField(decimal_places=3, help_text='Siempre positiva; el signo lo determina el tipo de movimiento.', max_digits=14, validators=[django.core.validators.MinValueValidator(0.001)], verbose_name='Cantidad')),
                ('signed_quantity', models.DecimalField(decimal_places=3, editable=False, max_digits=14, verbose_name='Cantidad con signo')),
                ('balance_after', models.DecimalField(decimal_places=3, editable=False, max_digits=14, verbose_name='Saldo posterior')),
                ('unit_cost', models.DecimalField(decimal_places=4, default=Decimal('0.00'), max_digits=10, verbose_name='Costo unitario')),
                ('total_cost', models.DecimalField(decimal_places=4, default=Decimal('0.00'), max_digits=14, verbose_name='Costo total')),
                ('reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo')),
                ('object_id', models.PositiveBigIntegerField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'Movimiento de inventario',
                'verbose_name_plural': 'Kardex',
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.CreateModel(
            name='Warehouse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado en')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Vigente')),
                ('deleted_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Desactivado en')),
                ('deletion_reason', models.CharField(blank=True, max_length=255, verbose_name='Motivo de baja')),
                ('code', models.CharField(max_length=15, verbose_name='Clave')),
                ('name', models.CharField(max_length=80, verbose_name='Nombre')),
                ('warehouse_type', models.CharField(choices=[('GENERAL', 'Almacen general'), ('KITCHEN', 'Cocina'), ('BAR', 'Bar'), ('HOUSEKEEPING', 'Ama de llaves'), ('MINIBAR', 'Frigobar / habitaciones'), ('SHOP', 'Tienda')], default='GENERAL', max_length=15, verbose_name='Tipo')),
                ('location', models.CharField(blank=True, max_length=120, verbose_name='Ubicacion')),
                ('is_default_for_sales', models.BooleanField(default=False, help_text='Del que se descuenta el room service si no se indica otro.', verbose_name='Almacen de venta por defecto')),
            ],
            options={
                'verbose_name': 'Almacen',
                'verbose_name_plural': 'Almacenes',
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
            name='WarehouseStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.DecimalField(decimal_places=3, default=Decimal('0.00'), max_digits=14, verbose_name='Existencia')),
                ('reserved_quantity', models.DecimalField(decimal_places=3, default=Decimal('0.00'), max_digits=14, verbose_name='Comprometido')),
                ('min_stock', models.DecimalField(decimal_places=3, default=Decimal('0.00'), max_digits=12, verbose_name='Stock minimo')),
                ('max_stock', models.DecimalField(decimal_places=3, default=Decimal('0.00'), max_digits=12, verbose_name='Stock maximo')),
                ('low_stock_notified_at', models.DateTimeField(blank=True, editable=False, null=True, verbose_name='Ultima alerta de stock')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Actualizado en')),
            ],
            options={
                'verbose_name': 'Existencia',
                'verbose_name_plural': 'Existencias',
                'ordering': ['warehouse', 'product'],
            },
        ),
    ]
