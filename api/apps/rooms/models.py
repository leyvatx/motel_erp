"""Habitaciones, tarifas dinamicas, reservaciones y rentas (estancias).

Reglas clave que viven aquí:
* El backend es la única fuente de verdad del tiempo: ``check_in_at`` y
  ``expires_at`` se guardan en UTC y el frontend solo los renderiza.
* Una habitación no puede tener dos rentas activas: lo garantiza una
  restriccion única parcial en base de datos, no solo la capa de servicio.
* El estado de la habitación solo se mueve por la máquina de estados.
"""

from __future__ import annotations

from decimal import Decimal

from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from common.models import BaseModel, ImmutableModel
from common.utils import ZERO

from apps.rooms.constants import (
    PriceMode,
    ReservationStatus,
    RoomStatus,
    StayStatus,
    TariffRuleType,
)


class RoomType(BaseModel):
    """Categoría comercial de la habitación (Sencilla, Jacuzzi, Suite...)."""

    name = models.CharField("Nombre", max_length=60)
    code = models.CharField("Clave", max_length=15)
    description = models.TextField("Descripción", blank=True)
    max_occupants = models.PositiveSmallIntegerField("Ocupantes máximos", default=2)
    extra_person_price = models.DecimalField(
        "Precio por persona extra", max_digits=10, decimal_places=2, default=ZERO
    )
    sort_order = models.PositiveSmallIntegerField("Orden", default=0)

    class Meta(BaseModel.Meta):
        verbose_name = "Tipo de habitación"
        verbose_name_plural = "Tipos de habitación"
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                condition=models.Q(is_active=True),
                name="uniq_active_room_type_code",
            )
        ]

    def __str__(self) -> str:
        return self.name


class Room(BaseModel):
    """Habitación física."""

    number = models.CharField("Número", max_length=10, db_index=True)
    room_type = models.ForeignKey(
        RoomType,
        verbose_name="Tipo",
        on_delete=models.PROTECT,
        related_name="rooms",
    )
    status = models.CharField(
        "Estado",
        max_length=15,
        choices=RoomStatus.choices,
        default=RoomStatus.AVAILABLE,
        db_index=True,
        help_text="Solo debe modificarse mediante la máquina de estados.",
    )
    floor = models.PositiveSmallIntegerField("Piso", default=1)
    zone = models.CharField("Zona / edificio", max_length=40, blank=True)
    has_garage = models.BooleanField("Cochera privada", default=True)
    notes = models.TextField("Observaciones", blank=True)
    status_changed_at = models.DateTimeField(
        "Último cambio de estado", default=timezone.now, editable=False
    )
    out_of_service_reason = models.CharField(
        "Motivo fuera de servicio", max_length=255, blank=True
    )

    class Meta(BaseModel.Meta):
        verbose_name = "Habitación"
        verbose_name_plural = "Habitaciones"
        ordering = ["floor", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["number"],
                condition=models.Q(is_active=True),
                name="uniq_active_room_number",
            )
        ]
        indexes = [
            models.Index(fields=["status", "is_active"], name="room_status_active_idx"),
            models.Index(fields=["room_type", "status"], name="room_type_status_idx"),
        ]

    def __str__(self) -> str:
        return f"Habitacion {self.number}"

    @property
    def is_rentable(self) -> bool:
        return self.is_active and self.status in {RoomStatus.AVAILABLE, RoomStatus.RESERVED}

    @property
    def current_stay(self) -> "Stay | None":
        return self.stays.filter(status=StayStatus.ACTIVE).first()


class TariffBlock(BaseModel):
    """Bloque de tiempo vendible: 4 horas, 8 horas, pernocta, etc."""

    room_type = models.ForeignKey(
        RoomType,
        verbose_name="Tipo de habitación",
        on_delete=models.PROTECT,
        related_name="tariff_blocks",
    )
    name = models.CharField("Nombre", max_length=60)
    duration_minutes = models.PositiveIntegerField(
        "Duración (minutos)", validators=[MinValueValidator(1)]
    )
    base_price = models.DecimalField(
        "Precio base", max_digits=10, decimal_places=2, validators=[MinValueValidator(ZERO)]
    )
    grace_minutes = models.PositiveSmallIntegerField(
        "Tolerancia (minutos)",
        default=15,
        help_text="Minutos posteriores al vencimiento sin recargo.",
    )
    overstay_hour_price = models.DecimalField(
        "Recargo por hora extra",
        max_digits=10,
        decimal_places=2,
        default=ZERO,
        help_text="Se cobra por cada hora iniciada después de la tolerancia.",
    )
    is_overnight = models.BooleanField("Es pernocta", default=False)
    is_default = models.BooleanField("Bloque sugerido", default=False)
    sort_order = models.PositiveSmallIntegerField("Orden", default=0)

    class Meta(BaseModel.Meta):
        verbose_name = "Bloque tarifario"
        verbose_name_plural = "Bloques tarifarios"
        ordering = ["room_type", "sort_order", "duration_minutes"]
        constraints = [
            models.UniqueConstraint(
                fields=["room_type", "name"],
                condition=models.Q(is_active=True),
                name="uniq_active_tariff_block_name",
            ),
            models.CheckConstraint(
                condition=models.Q(duration_minutes__gt=0),
                name="tariff_block_duration_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.room_type.name} - {self.name}"

    @property
    def duration_hours(self) -> Decimal:
        return Decimal(self.duration_minutes) / Decimal(60)


class Holiday(BaseModel):
    """Día festivo con tarifa diferenciada."""

    date = models.DateField("Fecha", db_index=True)
    name = models.CharField("Nombre", max_length=80)

    class Meta(BaseModel.Meta):
        verbose_name = "Día festivo"
        verbose_name_plural = "Días festivos"
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(
                fields=["date"],
                condition=models.Q(is_active=True),
                name="uniq_active_holiday_date",
            )
        ]

    def __str__(self) -> str:
        return f"{self.date:%d/%m/%Y} - {self.name}"


class TariffRule(BaseModel):
    """Ajuste dinamico de precio sobre un bloque tarifario.

    Se evalua por prioridad descendente; gana la primera regla vigente que
    aplique al momento del check-in.
    """

    tariff_block = models.ForeignKey(
        TariffBlock,
        verbose_name="Bloque tarifario",
        on_delete=models.CASCADE,
        related_name="rules",
    )
    name = models.CharField("Nombre", max_length=80)
    rule_type = models.CharField("Tipo", max_length=15, choices=TariffRuleType.choices)
    weekdays = ArrayField(
        models.PositiveSmallIntegerField(),
        verbose_name="Días de la semana",
        default=list,
        blank=True,
        help_text="0=lunes ... 6=domingo. Solo para reglas de tipo WEEKDAY.",
    )
    start_date = models.DateField("Desde", null=True, blank=True)
    end_date = models.DateField("Hasta", null=True, blank=True)
    start_time = models.TimeField("Hora inicial", null=True, blank=True)
    end_time = models.TimeField("Hora final", null=True, blank=True)
    price_mode = models.CharField(
        "Modo de precio", max_length=12, choices=PriceMode.choices, default=PriceMode.FIXED
    )
    value = models.DecimalField(
        "Valor",
        max_digits=10,
        decimal_places=2,
        help_text="Precio fijo, factor multiplicador o monto adicional según el modo.",
    )
    priority = models.PositiveSmallIntegerField(
        "Prioridad", default=100, help_text="Mayor número gana."
    )

    class Meta(BaseModel.Meta):
        verbose_name = "Regla tarifaria"
        verbose_name_plural = "Reglas tarifarias"
        ordering = ["-priority", "name"]
        indexes = [
            models.Index(
                fields=["tariff_block", "rule_type", "is_active"],
                name="tariff_rule_lookup_idx",
            )
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(start_date__isnull=True)
                    | models.Q(end_date__isnull=True)
                    | models.Q(end_date__gte=models.F("start_date"))
                ),
                name="tariff_rule_date_range_valid",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_rule_type_display()})"


class Reservation(BaseModel):
    """Reservación anticipada de una habitación o de un tipo de habitación."""

    code = models.CharField("Folio", max_length=25, unique=True, editable=False)
    room = models.ForeignKey(
        Room,
        verbose_name="Habitación",
        on_delete=models.PROTECT,
        related_name="reservations",
        null=True,
        blank=True,
        help_text="Opcional: si se deja vacio se asigna al hacer check-in.",
    )
    room_type = models.ForeignKey(
        RoomType,
        verbose_name="Tipo de habitación",
        on_delete=models.PROTECT,
        related_name="reservations",
    )
    tariff_block = models.ForeignKey(
        TariffBlock,
        verbose_name="Bloque tarifario",
        on_delete=models.PROTECT,
        related_name="reservations",
        null=True,
        blank=True,
    )
    status = models.CharField(
        "Estado",
        max_length=12,
        choices=ReservationStatus.choices,
        default=ReservationStatus.CONFIRMED,
        db_index=True,
    )
    guest_name = models.CharField("Nombre del huesped", max_length=120, blank=True)
    guest_phone = models.CharField("Teléfono", max_length=20, blank=True)
    vehicle_plate = models.CharField("Placas", max_length=15, blank=True, db_index=True)
    occupants = models.PositiveSmallIntegerField("Ocupantes", default=2)
    scheduled_start = models.DateTimeField("Inicio programado", db_index=True)
    scheduled_end = models.DateTimeField("Fin programado")
    deposit_amount = models.DecimalField(
        "Anticipo", max_digits=10, decimal_places=2, default=ZERO
    )
    quoted_price = models.DecimalField(
        "Precio cotizado", max_digits=10, decimal_places=2, default=ZERO
    )
    notes = models.TextField("Notas", blank=True)
    cancelled_at = models.DateTimeField("Cancelada en", null=True, blank=True)
    cancellation_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Reservación"
        verbose_name_plural = "Reservaciones"
        ordering = ["scheduled_start"]
        indexes = [
            models.Index(
                fields=["room", "scheduled_start", "scheduled_end"],
                name="reservation_window_idx",
            ),
            models.Index(fields=["status", "scheduled_start"], name="reservation_status_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(scheduled_end__gt=models.F("scheduled_start")),
                name="reservation_window_valid",
            )
        ]

    def __str__(self) -> str:
        return f"{self.code} - {self.guest_name or 'Sin nombre'}"

    @property
    def blocks_room(self) -> bool:
        """Indica si la reservación todavía compromete la habitación."""
        return self.status in {ReservationStatus.PENDING, ReservationStatus.CONFIRMED}


class Stay(BaseModel):
    """Renta activa o histórica de una habitación.

    ``expires_at`` es el corazón del cronómetro inverso: se calcula en el
    servidor al rentar y se recalcula en cada extensión.
    """

    code = models.CharField("Folio de renta", max_length=25, unique=True, editable=False)
    room = models.ForeignKey(
        Room, verbose_name="Habitación", on_delete=models.PROTECT, related_name="stays"
    )
    room_type = models.ForeignKey(
        RoomType,
        verbose_name="Tipo (snapshot)",
        on_delete=models.PROTECT,
        related_name="stays",
    )
    tariff_block = models.ForeignKey(
        TariffBlock,
        verbose_name="Bloque tarifario",
        on_delete=models.PROTECT,
        related_name="stays",
    )
    reservation = models.OneToOneField(
        Reservation,
        verbose_name="Reservación origen",
        on_delete=models.PROTECT,
        related_name="stay",
        null=True,
        blank=True,
    )
    status = models.CharField(
        "Estado",
        max_length=10,
        choices=StayStatus.choices,
        default=StayStatus.ACTIVE,
        db_index=True,
    )

    check_in_at = models.DateTimeField("Entrada", default=timezone.now, db_index=True)
    expires_at = models.DateTimeField("Vence en", db_index=True)
    checked_out_at = models.DateTimeField("Salida real", null=True, blank=True)
    base_minutes = models.PositiveIntegerField("Minutos contratados")
    extended_minutes = models.PositiveIntegerField("Minutos extendidos", default=0)

    base_price = models.DecimalField("Precio base", max_digits=10, decimal_places=2)
    extra_person_price = models.DecimalField(
        "Cargo por personas extra", max_digits=10, decimal_places=2, default=ZERO
    )

    occupants = models.PositiveSmallIntegerField("Ocupantes", default=2)
    guest_name = models.CharField("Nombre del huesped", max_length=120, blank=True)
    vehicle_plate = models.CharField("Placas", max_length=15, blank=True, db_index=True)
    vehicle_description = models.CharField("Vehículo", max_length=80, blank=True)
    notes = models.TextField("Notas", blank=True)

    closed_by = models.ForeignKey(
        "users.User",
        verbose_name="Cerrada por",
        on_delete=models.PROTECT,
        related_name="closed_stays",
        null=True,
        blank=True,
    )
    cancelled_at = models.DateTimeField("Cancelada en", null=True, blank=True)
    cancellation_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    warning_notified_at = models.DateTimeField(
        "Aviso de por vencer", null=True, blank=True, editable=False
    )
    expired_notified_at = models.DateTimeField(
        "Aviso de vencimiento", null=True, blank=True, editable=False
    )

    class Meta(BaseModel.Meta):
        verbose_name = "Renta"
        verbose_name_plural = "Rentas"
        ordering = ["-check_in_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["room"],
                condition=models.Q(status=StayStatus.ACTIVE),
                name="uniq_active_stay_per_room",
            ),
            models.CheckConstraint(
                condition=models.Q(expires_at__gt=models.F("check_in_at")),
                name="stay_expiration_after_checkin",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "expires_at"], name="stay_status_expires_idx"),
            models.Index(fields=["room", "status"], name="stay_room_status_idx"),
            models.Index(fields=["vehicle_plate"], name="stay_plate_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.code} - Habitacion {self.room.number}"

    @property
    def total_minutes(self) -> int:
        return self.base_minutes + self.extended_minutes

    @property
    def is_expired(self) -> bool:
        return self.status == StayStatus.ACTIVE and timezone.now() >= self.expires_at

    @property
    def remaining_seconds(self) -> int:
        """Segundos restantes; negativo si el huesped ya se paso del tiempo."""
        return int((self.expires_at - timezone.now()).total_seconds())

    @property
    def deadline_with_grace(self):
        from datetime import timedelta

        return self.expires_at + timedelta(minutes=self.tariff_block.grace_minutes)


class StayExtension(BaseModel):
    """Prolongacion de tiempo sobre una renta activa."""

    stay = models.ForeignKey(
        Stay, verbose_name="Renta", on_delete=models.PROTECT, related_name="extensions"
    )
    tariff_block = models.ForeignKey(
        TariffBlock,
        verbose_name="Bloque aplicado",
        on_delete=models.PROTECT,
        related_name="extensions",
        null=True,
        blank=True,
    )
    minutes = models.PositiveIntegerField("Minutos agregados", validators=[MinValueValidator(1)])
    price = models.DecimalField("Importe", max_digits=10, decimal_places=2)
    previous_expires_at = models.DateTimeField("Vencimiento anterior")
    new_expires_at = models.DateTimeField("Nuevo vencimiento")
    reason = models.CharField("Motivo", max_length=255, blank=True)
    is_overstay_surcharge = models.BooleanField(
        "Es recargo por tiempo excedido",
        default=False,
        help_text="Se marca cuando la extensión la genera el sistema por sobreestadia.",
    )

    class Meta(BaseModel.Meta):
        verbose_name = "Extensión de renta"
        verbose_name_plural = "Extensiones de renta"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["stay", "-created_at"], name="stay_extension_stay_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.stay.code} +{self.minutes} min"


class RoomStatusLog(ImmutableModel):
    """Historial inmutable de transiciones de estado de cada habitación.

    Alimenta los reportes de tiempos de limpieza y la trazabilidad del grid.
    """

    room = models.ForeignKey(
        Room, verbose_name="Habitación", on_delete=models.PROTECT, related_name="status_logs"
    )
    stay = models.ForeignKey(
        Stay,
        verbose_name="Renta relacionada",
        on_delete=models.PROTECT,
        related_name="status_logs",
        null=True,
        blank=True,
    )
    from_status = models.CharField("Estado anterior", max_length=15, choices=RoomStatus.choices)
    to_status = models.CharField("Estado nuevo", max_length=15, choices=RoomStatus.choices)
    reason = models.CharField("Motivo", max_length=255, blank=True)
    changed_by = models.ForeignKey(
        "users.User",
        verbose_name="Cambiado por",
        on_delete=models.PROTECT,
        related_name="room_status_changes",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "Cambio de estado de habitación"
        verbose_name_plural = "Cambios de estado de habitación"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["room", "-created_at"], name="room_status_log_room_idx"),
            models.Index(fields=["to_status", "-created_at"], name="room_status_log_to_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.room.number}: {self.from_status} -> {self.to_status}"
