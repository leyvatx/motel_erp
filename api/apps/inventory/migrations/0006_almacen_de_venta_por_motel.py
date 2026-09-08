"""Un almacén de venta por motel, y su renglón de existencias por producto.

El alta de un motel no creaba almacén, y el punto de venta descuenta de uno:
esos negocios veían el botón de cobrar habilitado y la venta fallaba siempre.
El alta ya lo crea (``apps.settings.services.create_motel``); esto repara a los
que se dieron de alta antes.

Solo toca a los moteles que no tienen ninguno. A quien ya organizó sus
almacenes no se le agrega nada ni se le cambia cuál es el de venta.
"""

from django.db import migrations


def crear_almacen_general(apps, schema_editor):
    Motel = apps.get_model("settings", "Motel")
    Warehouse = apps.get_model("inventory", "Warehouse")

    con_almacen = set(Warehouse.objects.values_list("motel_id", flat=True))
    faltantes = [motel for motel in Motel.objects.all() if motel.id not in con_almacen]

    Warehouse.objects.bulk_create(
        [
            Warehouse(
                motel=motel,
                code="GEN",
                name="Almacén general",
                warehouse_type="GENERAL",
                is_default_for_sales=True,
            )
            for motel in faltantes
        ]
    )


def crear_renglones_en_cero(apps, schema_editor):
    """Los inventariables que nunca tuvieron renglón de existencias.

    Inventarios lista existencias, no productos: sin renglón, un producto
    inventariable no aparece en la única pantalla donde se le registra la
    mercancía que le falta -- y no se puede vender, porque la venta descuenta.
    """
    Product = apps.get_model("inventory", "Product")
    Warehouse = apps.get_model("inventory", "Warehouse")
    WarehouseStock = apps.get_model("inventory", "WarehouseStock")

    con_renglon = set(WarehouseStock.objects.values_list("product_id", flat=True))
    almacenes = {}
    for almacen in Warehouse.objects.filter(is_active=True).order_by(
        "-is_default_for_sales", "id"
    ):
        almacenes.setdefault(almacen.motel_id, almacen)

    nuevos = []
    for producto in Product.objects.filter(is_stockable=True):
        if producto.id in con_renglon:
            continue
        almacen = almacenes.get(producto.motel_id)
        if almacen is None:
            continue
        nuevos.append(
            WarehouseStock(motel_id=producto.motel_id, product=producto, warehouse=almacen)
        )

    WarehouseStock.objects.bulk_create(nuevos)


def sin_vuelta(apps, schema_editor):
    """No se borra nada: puede tener existencias y movimientos colgando."""


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0005_product_image"),
        ("settings", "0008_signupattempt"),
    ]

    operations = [
        migrations.RunPython(crear_almacen_general, sin_vuelta),
        migrations.RunPython(crear_renglones_en_cero, sin_vuelta),
    ]
