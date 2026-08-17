"""Serializadores del modulo de recepción.

Los cronómetros se exponen como ``expires_at`` (UTC) más
``remaining_seconds`` calculado por el servidor: el frontend solo pinta la
cuenta regresiva a partir de esos valores.
"""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from common.serializers import ReasonSerializer

from apps.rooms.constants import RoomStatus
from apps.rooms.models import (
    Holiday,
    Reservation,
    Room,
    RoomStatusLog,
    RoomType,
    Stay,
    StayExtension,
    TariffBlock,
    TariffRule,
)
from apps.sales.constants import PaymentMethod


class RoomTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomType
        fields = (
            "id",
            "name",
            "code",
            "description",
            "max_occupants",
            "extra_person_price",
            "sort_order",
            "is_active",
        )


class TariffRuleSerializer(serializers.ModelSerializer):
    rule_type_display = serializers.CharField(source="get_rule_type_display", read_only=True)

    class Meta:
        model = TariffRule
        fields = (
            "id",
            "tariff_block",
            "name",
            "rule_type",
            "rule_type_display",
            "weekdays",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "price_mode",
            "value",
            "priority",
            "is_active",
        )


class TariffBlockSerializer(serializers.ModelSerializer):
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)
    rules = TariffRuleSerializer(many=True, read_only=True)
    current_price = serializers.SerializerMethodField()

    class Meta:
        model = TariffBlock
        fields = (
            "id",
            "room_type",
            "room_type_name",
            "name",
            "duration_minutes",
            "base_price",
            "current_price",
            "grace_minutes",
            "overstay_hour_price",
            "is_overnight",
            "is_default",
            "sort_order",
            "is_active",
            "rules",
        )

    def get_current_price(self, block: TariffBlock) -> Decimal:
        from apps.rooms.services import resolve_tariff_price

        return resolve_tariff_price(block)


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ("id", "date", "name", "is_active")


class StayExtensionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StayExtension
        fields = (
            "id",
            "minutes",
            "price",
            "previous_expires_at",
            "new_expires_at",
            "reason",
            "is_overstay_surcharge",
            "created_at",
        )
        read_only_fields = fields


class StaySerializer(serializers.ModelSerializer):
    """Detalle de renta con el estado del cronómetro y de la cuenta."""

    room_number = serializers.CharField(source="room.number", read_only=True)
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)
    tariff_block_name = serializers.CharField(source="tariff_block.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    remaining_seconds = serializers.IntegerField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    total_minutes = serializers.IntegerField(read_only=True)
    extensions = StayExtensionSerializer(many=True, read_only=True)
    folio_id = serializers.IntegerField(source="folio.id", read_only=True, default=None)
    folio_total = serializers.DecimalField(
        source="folio.total", max_digits=12, decimal_places=2, read_only=True, default=None
    )
    folio_balance = serializers.DecimalField(
        source="folio.balance", max_digits=12, decimal_places=2, read_only=True, default=None
    )
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default=None)

    class Meta:
        model = Stay
        fields = (
            "id",
            "code",
            "room",
            "room_number",
            "room_type",
            "room_type_name",
            "tariff_block",
            "tariff_block_name",
            "reservation",
            "status",
            "status_display",
            "check_in_at",
            "expires_at",
            "checked_out_at",
            "remaining_seconds",
            "is_expired",
            "base_minutes",
            "extended_minutes",
            "total_minutes",
            "base_price",
            "extra_person_price",
            "occupants",
            "guest_name",
            "vehicle_plate",
            "vehicle_description",
            "notes",
            "cancelled_at",
            "cancellation_reason",
            "created_at",
            "created_by_name",
            "folio_id",
            "folio_total",
            "folio_balance",
            "extensions",
        )
        read_only_fields = fields


class StayListSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source="room.number", read_only=True)
    remaining_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = Stay
        fields = (
            "id",
            "code",
            "room",
            "room_number",
            "status",
            "check_in_at",
            "expires_at",
            "remaining_seconds",
            "vehicle_plate",
            "guest_name",
        )
        read_only_fields = fields


class RoomSerializer(serializers.ModelSerializer):
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Room
        fields = (
            "id",
            "number",
            "room_type",
            "room_type_name",
            "status",
            "status_display",
            "floor",
            "zone",
            "has_garage",
            "notes",
            "status_changed_at",
            "out_of_service_reason",
            "is_active",
        )
        read_only_fields = ("status", "status_changed_at", "out_of_service_reason")


class RoomGridSerializer(serializers.ModelSerializer):
    """Payload del grid de recepción. Una consulta, cero N+1."""

    room_type_name = serializers.CharField(source="room_type.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    current_stay = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = (
            "id",
            "number",
            "floor",
            "zone",
            "room_type",
            "room_type_name",
            "status",
            "status_display",
            "status_changed_at",
            "out_of_service_reason",
            "current_stay",
        )
        read_only_fields = fields

    def get_current_stay(self, room: Room) -> dict | None:
        stays = getattr(room, "active_stays", [])
        if not stays:
            return None
        stay = stays[0]
        folio = getattr(stay, "folio", None)
        return {
            "id": stay.pk,
            "code": stay.code,
            "check_in_at": stay.check_in_at,
            "expires_at": stay.expires_at,
            "remaining_seconds": stay.remaining_seconds,
            "is_expired": stay.is_expired,
            "occupants": stay.occupants,
            "guest_name": stay.guest_name,
            "vehicle_plate": stay.vehicle_plate,
            "tariff_block_name": stay.tariff_block.name,
            "folio_id": folio.pk if folio else None,
            "folio_total": folio.total if folio else None,
            "folio_balance": folio.balance if folio else None,
        }


class ReservationSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source="room.number", read_only=True, default=None)
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Reservation
        fields = (
            "id",
            "code",
            "room",
            "room_number",
            "room_type",
            "room_type_name",
            "tariff_block",
            "status",
            "status_display",
            "guest_name",
            "guest_phone",
            "vehicle_plate",
            "occupants",
            "scheduled_start",
            "scheduled_end",
            "deposit_amount",
            "quoted_price",
            "notes",
            "cancelled_at",
            "cancellation_reason",
            "created_at",
        )
        read_only_fields = fields


class RoomStatusLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(
        source="changed_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = RoomStatusLog
        fields = (
            "id",
            "room",
            "stay",
            "from_status",
            "to_status",
            "reason",
            "changed_by",
            "changed_by_name",
            "created_at",
        )
        read_only_fields = fields


class RentRoomSerializer(serializers.Serializer):
    """Alta de renta. El servidor calcula precio y vencimiento."""

    room_id = serializers.IntegerField()
    tariff_block_id = serializers.IntegerField()
    occupants = serializers.IntegerField(min_value=1, max_value=20, default=2)
    guest_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    vehicle_plate = serializers.CharField(required=False, allow_blank=True, max_length=15)
    vehicle_description = serializers.CharField(required=False, allow_blank=True, max_length=80)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    reservation_id = serializers.IntegerField(required=False, allow_null=True)


class ExtendStaySerializer(serializers.Serializer):
    tariff_block_id = serializers.IntegerField(required=False, allow_null=True)
    minutes = serializers.IntegerField(required=False, min_value=1, max_value=60 * 48)
    price = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, min_value=Decimal("0")
    )
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs: dict) -> dict:
        if not attrs.get("tariff_block_id") and not attrs.get("minutes"):
            raise serializers.ValidationError(
                "Indica un bloque tarifario o los minutos a extender."
            )
        if not attrs.get("tariff_block_id") and attrs.get("price") is None:
            raise serializers.ValidationError(
                "Una extensión por minutos requiere el importe a cobrar."
            )
        return attrs


class CheckoutPaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=PaymentMethod.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    tendered_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, min_value=Decimal("0")
    )
    reference = serializers.CharField(required=False, allow_blank=True, max_length=60)


class CheckoutStaySerializer(serializers.Serializer):
    payments = CheckoutPaymentSerializer(many=True, required=False)
    apply_overstay = serializers.BooleanField(default=True)
    discount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, min_value=Decimal("0")
    )
    discount_reason = serializers.CharField(required=False, allow_blank=True, max_length=180)


class ReservationInputSerializer(serializers.Serializer):
    room_type_id = serializers.IntegerField()
    room_id = serializers.IntegerField(required=False, allow_null=True)
    tariff_block_id = serializers.IntegerField(required=False, allow_null=True)
    scheduled_start = serializers.DateTimeField()
    scheduled_end = serializers.DateTimeField()
    guest_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    guest_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    vehicle_plate = serializers.CharField(required=False, allow_blank=True, max_length=15)
    occupants = serializers.IntegerField(min_value=1, max_value=20, default=2)
    deposit_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, min_value=Decimal("0")
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class RoomServiceStatusSerializer(serializers.Serializer):
    """Cambio manual de estado del cuarto (mantenimiento / bloqueo)."""

    reason = serializers.CharField(max_length=255)
    blocked = serializers.BooleanField(default=False)


class RoomStatusSummarySerializer(serializers.Serializer):
    """Conteo de cuartos por estado para las tarjetas del dashboard."""

    status = serializers.ChoiceField(choices=RoomStatus.choices)
    status_display = serializers.CharField()
    count = serializers.IntegerField()
