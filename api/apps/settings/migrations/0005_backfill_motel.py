"""Adopta los datos que ya existian: todo pasa a ser del primer motel.

La instalación venia siendo de un solo motel, así que cada habitación, turno,
folio y usuario que ya estaba en la base pertenece a ese. Sin este paso los
registros viejos quedarian sin dueño y desaparecerian de todas las pantallas,
porque los managers filtran por motel.
"""

from django.db import migrations

SCOPED_MODELS = [
    ("common", "DocumentSequence"),
    ("rooms", "RoomType"),
    ("rooms", "Room"),
    ("rooms", "TariffBlock"),
    ("rooms", "TariffRule"),
    ("rooms", "Holiday"),
    ("rooms", "Reservation"),
    ("rooms", "Stay"),
    ("rooms", "StayExtension"),
    ("rooms", "RoomStatusLog"),
    ("inventory", "Warehouse"),
    ("inventory", "ProductCategory"),
    ("inventory", "Product"),
    ("inventory", "WarehouseStock"),
    ("inventory", "StockLot"),
    ("inventory", "StockMovement"),
    ("sales", "Folio"),
    ("sales", "FolioCharge"),
    ("sales", "Order"),
    ("sales", "OrderItem"),
    ("sales", "Payment"),
    ("sales", "Receipt"),
    ("housekeeping", "CleaningTask"),
    ("housekeeping", "MaintenanceReport"),
    ("housekeeping", "MaintenanceUpdate"),
    ("finances", "Shift"),
    ("finances", "CashCount"),
    ("finances", "CashMovement"),
    ("finances", "Expense"),
    ("notifications", "Notification"),
    ("audit", "AuditLog"),
    ("users", "User"),
]


def backfill(apps, schema_editor):
    Motel = apps.get_model("settings", "Motel")
    motel = Motel.objects.order_by("pk").first()
    if motel is None:
        return

    for app_label, model_name in SCOPED_MODELS:
        model = apps.get_model(app_label, model_name)
        model.objects.filter(motel__isnull=True).update(motel=motel)


def clear(apps, schema_editor):
    for app_label, model_name in SCOPED_MODELS:
        model = apps.get_model(app_label, model_name)
        model.objects.update(motel=None)


class Migration(migrations.Migration):
    dependencies = [
        ("settings", "0004_alter_motel_managers"),
        ("common", "0002_remove_documentsequence_uniq_document_sequence_key_period_and_more"),
        ("rooms", "0003_alter_holiday_options_alter_reservation_options_and_more"),
        ("inventory", "0003_alter_productcategory_options_and_more"),
        ("sales", "0004_alter_orderitem_options_folio_motel_and_more"),
        ("housekeeping", "0002_alter_maintenanceupdate_managers_cleaningtask_motel_and_more"),
        ("finances", "0002_alter_cashmovement_managers_cashcount_motel_and_more"),
        ("notifications", "0003_alter_notification_options_notification_motel_and_more"),
        ("audit", "0002_alter_auditlog_options_alter_auditlog_managers_and_more"),
        ("users", "0003_user_motel"),
    ]

    operations = [migrations.RunPython(backfill, clear)]
