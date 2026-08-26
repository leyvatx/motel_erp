from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import Coalesce, TruncDate, TruncHour
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.finances.constants import ExpenseStatus, ShiftStatus
from apps.finances.models import Expense, Shift
from apps.housekeeping.constants import CleaningTaskStatus, MaintenanceStatus
from apps.housekeeping.models import CleaningTask, MaintenanceReport
from apps.rooms.constants import StayStatus
from apps.rooms.models import Room, Stay
from apps.sales.constants import OrderStatus, PaymentStatus
from apps.sales.models import OrderItem, Payment
from common.utils import business_date, business_tz

ZERO = Decimal("0.00")
MONEY = DecimalField(max_digits=18, decimal_places=2)


def period(params) -> tuple[date, date, datetime, datetime]:
    today = business_date()
    try:
        start = date.fromisoformat(params.get("from")) if params.get("from") else today - timedelta(days=29)
        end = date.fromisoformat(params.get("to")) if params.get("to") else today
    except ValueError as exc:
        raise ValidationError("Las fechas deben usar el formato YYYY-MM-DD.") from exc
    if start > end:
        raise ValidationError("La fecha inicial no puede ser posterior a la final.")
    if (end - start).days > 366:
        raise ValidationError("El periodo máximo de consulta es de 367 días.")
    tz = business_tz()
    lower = timezone.make_aware(datetime.combine(start, time.min), tz)
    upper = timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min), tz)
    return start, end, lower, upper


def _money(value) -> Decimal:
    return value or ZERO


def occupancy_report(params) -> dict:
    start, end, lower, upper = period(params)
    stays = Stay.objects.filter(check_in_at__gte=lower, check_in_at__lt=upper).exclude(status=StayStatus.CANCELLED)
    daily_rows = stays.annotate(day=TruncDate("check_in_at", tzinfo=business_tz())).values("day").annotate(rentals=Count("id")).order_by("day")
    durations = [stay.total_minutes for stay in stays.only("base_minutes", "extended_minutes")]
    room_count = Room.objects.filter(is_active=True).count()
    days = (end - start).days + 1
    occupied_minutes = sum(durations)
    capacity = room_count * days * 1440
    by_type = stays.values(name=F("room_type__name")).annotate(rentals=Count("id")).order_by("-rentals")
    return {
        "summary": {
            "rentals": stays.count(),
            "rooms": room_count,
            "average_minutes": round(occupied_minutes / len(durations)) if durations else 0,
            "occupancy_rate": round(min(occupied_minutes / capacity * 100, 100), 1) if capacity else 0,
        },
        "daily": [{"date": row["day"], "rentals": row["rentals"]} for row in daily_rows],
        "by_room_type": list(by_type),
    }


def revenue_report(params) -> dict:
    _, _, lower, upper = period(params)
    payments = Payment.objects.filter(paid_at__gte=lower, paid_at__lt=upper, status=PaymentStatus.APPLIED)
    daily = payments.annotate(day=TruncDate("paid_at", tzinfo=business_tz())).values("day").annotate(revenue=Coalesce(Sum("amount"), ZERO, output_field=MONEY), payments=Count("id")).order_by("day")
    methods = payments.values("method").annotate(total=Coalesce(Sum("amount"), ZERO, output_field=MONEY), payments=Count("id")).order_by("-total")
    expenses = Expense.objects.filter(created_at__gte=lower, created_at__lt=upper, status=ExpenseStatus.APPROVED).aggregate(total=Coalesce(Sum("amount"), ZERO, output_field=MONEY))["total"]
    totals = payments.aggregate(revenue=Coalesce(Sum("amount"), ZERO, output_field=MONEY), payments=Count("id"))
    return {
        "summary": {**totals, "expenses": _money(expenses), "net": _money(totals["revenue"]) - _money(expenses)},
        "daily": [{"date": row["day"], "revenue": row["revenue"], "payments": row["payments"]} for row in daily],
        "by_method": list(methods),
    }


def products_report(params) -> dict:
    _, _, lower, upper = period(params)
    items = OrderItem.objects.filter(order__placed_at__gte=lower, order__placed_at__lt=upper, is_active=True).exclude(order__status=OrderStatus.CANCELLED)
    cost_expr = ExpressionWrapper(F("quantity") * F("product__average_cost"), output_field=MONEY)
    rows = items.values("product_id", name=F("product__name"), sku=F("product__sku")).annotate(quantity=Coalesce(Sum("quantity"), Decimal("0")), revenue=Coalesce(Sum("line_total"), ZERO, output_field=MONEY), cost=Coalesce(Sum(cost_expr), ZERO, output_field=MONEY)).order_by("-revenue")[:50]
    products = [{**row, "margin": _money(row["revenue"]) - _money(row["cost"])} for row in rows]
    return {
        "summary": {"products": len(products), "units": sum((_money(row["quantity"]) for row in products), Decimal("0")), "revenue": sum((_money(row["revenue"]) for row in products), ZERO), "margin": sum((_money(row["margin"]) for row in products), ZERO)},
        "products": products,
    }


def shifts_report(params) -> dict:
    start, end, _, _ = period(params)
    sales_expr = ExpressionWrapper(F("cash_sales") + F("card_sales") + F("transfer_sales"), output_field=MONEY)
    shifts = Shift.objects.filter(business_date__gte=start, business_date__lte=end).annotate(sales=sales_expr).values("id", "code", "business_date", "cashier__full_name", "shift_type", "status", "sales", "expenses_total", "difference", "folios_closed").order_by("-business_date", "-id")
    totals = shifts.aggregate(sales=Coalesce(Sum("sales"), ZERO, output_field=MONEY), expenses=Coalesce(Sum("expenses_total"), ZERO, output_field=MONEY), difference=Coalesce(Sum("difference"), ZERO, output_field=MONEY), shifts=Count("id"))
    return {"summary": totals, "shifts": list(shifts[:100])}


def housekeeping_report(params) -> dict:
    _, _, lower, upper = period(params)
    tasks = CleaningTask.objects.filter(finished_at__gte=lower, finished_at__lt=upper, status__in=[CleaningTaskStatus.DONE, CleaningTaskStatus.VERIFIED])
    employees = tasks.values("assigned_to_id", name=F("assigned_to__full_name")).annotate(tasks=Count("id"), average_seconds=Avg("duration_seconds"), issues=Count("id", filter=Q(found_issues=True))).order_by("-tasks")
    maintenance = MaintenanceReport.objects.filter(created_at__gte=lower, created_at__lt=upper)
    resolved = maintenance.filter(status=MaintenanceStatus.RESOLVED)
    return {
        "summary": {"tasks": tasks.count(), "average_seconds": tasks.aggregate(value=Avg("duration_seconds"))["value"] or 0, "issues": tasks.filter(found_issues=True).count(), "maintenance": maintenance.count(), "maintenance_resolved": resolved.count()},
        "employees": list(employees),
    }


def shift_trend_report(turno) -> dict:
    """Serie por hora de un turno: ventas cobradas y rentas iniciadas.

    Existe porque el panel necesitaba una tendencia y el turno solo guardaba
    totales. Los dos números salen de contar renglones reales -- pagos por
    ``paid_at`` y rentas por ``check_in_at`` -- y no de estimar nada: una
    gráfica inventada en un panel de caja es peor que no tener gráfica.

    Recibe el turno ya resuelto en vez de buscarlo. Quien llama es el viewset de
    turnos, cuyo ``get_queryset`` ya restringe a los propios cuando quien
    pregunta no es gerencia; buscar aquí el turno abierto se saltaría esa regla
    y le enseñaría a un recepcionista la caja de su compañero.
    """
    if turno is None:
        return {"shift": None, "hours": []}

    tz = business_tz()
    desde = turno.opened_at.astimezone(tz).replace(minute=0, second=0, microsecond=0)
    hasta = (turno.closed_at or timezone.now()).astimezone(tz)

    ventas = {
        fila["hora"]: fila["total"]
        for fila in Payment.objects.filter(
            shift=turno, status=PaymentStatus.APPLIED, paid_at__gte=desde
        )
        .annotate(hora=TruncHour("paid_at", tzinfo=tz))
        .values("hora")
        .annotate(total=Coalesce(Sum("amount"), ZERO, output_field=MONEY))
    }

    rentas = {
        fila["hora"]: fila["total"]
        for fila in Stay.objects.filter(check_in_at__gte=desde, check_in_at__lte=hasta)
        .exclude(status=StayStatus.CANCELLED)
        .annotate(hora=TruncHour("check_in_at", tzinfo=tz))
        .values("hora")
        .annotate(total=Count("id"))
    }

    # Las horas vacías se rellenan en cero en vez de omitirse. Sin esto una hora
    # sin ventas desaparece, la línea une las dos vecinas y dibuja una pendiente
    # continua donde en realidad no pasó nada.
    horas = []
    cursor = desde
    # Tope duro de 24: un turno que lleva días abierto es un error de operación,
    # no una razón para devolver mil puntos que nadie puede leer.
    while cursor <= hasta and len(horas) < 24:
        horas.append(
            {
                "hour": cursor.isoformat(),
                "label": cursor.strftime("%H:%M"),
                "sales": ventas.get(cursor, ZERO),
                "rentals": rentas.get(cursor, 0),
            }
        )
        cursor += timedelta(hours=1)

    return {"shift": turno.code, "hours": horas}
