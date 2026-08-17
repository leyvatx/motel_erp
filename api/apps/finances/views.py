"""API de finanzas: turnos, arqueos, movimientos de efectivo y gastos."""

from __future__ import annotations

from django.db.models import Sum
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.exceptions import DomainError

from apps.finances import services
from apps.users.constants import PermissionCode
from apps.finances.constants import ExpenseStatus, ShiftStatus
from apps.finances.models import CashCount, CashMovement, Expense, Shift
from apps.finances.serializers import (
    CashMovementInputSerializer,
    CashMovementSerializer,
    CashCountSerializer,
    CloseShiftSerializer,
    DenominationSerializer,
    ExpenseInputSerializer,
    ExpenseReviewSerializer,
    ExpenseSerializer,
    OpenShiftSerializer,
    ShiftListSerializer,
    ShiftSerializer,
    ShiftSummarySerializer,
    VerifyShiftSerializer,
)
from apps.users.models import User


class ShiftViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Turnos de caja.

    El resumen de cifras (``summary``) es exclusivo de gerencia: mostrarlo al
    cajero antes de declarar convertiría el corte ciego en uno a modo.
    """

    queryset = Shift.objects.select_related("cashier", "closed_by", "verified_by")
    serializer_class = ShiftSerializer
    required_permissions = {
        "open": [PermissionCode.SHIFT_OPEN],
        "close": [PermissionCode.SHIFT_CLOSE],
        "verify": [PermissionCode.SHIFT_VERIFY],
        "summary": [PermissionCode.REPORT_VIEW],
        "cash_movement": [PermissionCode.CASH_MOVE],
        "print_report": [PermissionCode.SHIFT_CLOSE],
    }
    filterset_fields = ["status", "cashier", "shift_type", "business_date"]
    search_fields = ["code", "cashier__full_name"]
    ordering_fields = ["opened_at", "closed_at", "business_date"]

    def get_serializer_class(self):
        return ShiftListSerializer if self.action == "list" else ShiftSerializer

    @extend_schema(request=OpenShiftSerializer, responses=ShiftSerializer)
    @action(detail=False, methods=["post"])
    def open(self, request) -> Response:
        serializer = OpenShiftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = dict(serializer.validated_data)

        cashier = request.user
        cashier_id = payload.pop("cashier_id", None)
        if cashier_id and cashier_id != request.user.pk:
            if not request.user.is_management:
                raise DomainError(
                    "Solo gerencia puede abrir un turno a nombre de otro cajero.",
                    code="forbidden_cashier",
                )
            cashier = User.objects.get(pk=cashier_id, is_active=True)

        shift = services.open_shift(cashier=cashier, actor=request.user, **payload)
        return Response(ShiftSerializer(shift).data, status=status.HTTP_201_CREATED)

    @extend_schema(responses=ShiftSerializer)
    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request) -> Response:
        """Turno abierto del usuario que consulta."""
        shift = services.get_open_shift(request.user)
        if shift is None:
            return Response({"detail": "Sin turno abierto."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ShiftSerializer(shift).data)

    @extend_schema(request=CloseShiftSerializer, responses=ShiftSerializer)
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None) -> Response:
        serializer = CloseShiftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        shift = self.get_object()
        if shift.cashier_id != request.user.pk and not request.user.is_management:
            raise DomainError("No puedes cerrar el turno de otro cajero.", code="forbidden_shift")

        shift = services.close_shift(
            shift_id=int(pk), actor=request.user, **serializer.validated_data
        )
        return Response(ShiftSerializer(shift).data)

    @extend_schema(request=VerifyShiftSerializer, responses=ShiftSerializer)
    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None) -> Response:
        """Arqueo de gerencia sobre el turno cerrado."""
        serializer = VerifyShiftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shift = services.verify_shift(
            shift_id=int(pk), actor=request.user, **serializer.validated_data
        )
        return Response(ShiftSerializer(shift).data)

    @extend_schema(responses=ShiftSummarySerializer)
    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None) -> Response:
        shift = self.get_object()
        return Response(ShiftSummarySerializer(services.compute_shift_totals(shift)).data)

    @extend_schema(request=CashMovementInputSerializer, responses=CashMovementSerializer)
    @action(detail=True, methods=["post"], url_path="cash-movements")
    def cash_movement(self, request, pk=None) -> Response:
        serializer = CashMovementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement = services.register_cash_movement(
            shift_id=int(pk), actor=request.user, **serializer.validated_data
        )
        return Response(
            CashMovementSerializer(movement).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(responses=CashCountSerializer(many=True))
    @action(detail=True, methods=["get"], url_path="cash-counts")
    def cash_counts(self, request, pk=None) -> Response:
        queryset = CashCount.objects.filter(shift_id=pk).select_related("counted_by")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(CashCountSerializer(page, many=True).data)

    @extend_schema(request=None, responses={200: None})
    @action(detail=True, methods=["post"], url_path="print-report")
    def print_report(self, request, pk=None) -> Response:
        """Reimprime el corte de turno en la termica."""
        from apps.sales.receipts import emit_shift_receipt, render

        shift = self.get_object()
        if shift.status == ShiftStatus.OPEN:
            raise DomainError("El turno todavía no se cierra.", code="shift_not_closed")

        receipt = emit_shift_receipt(shift=shift, actor=request.user, is_reprint=True)
        return Response({"receipt_id": receipt.pk, "preview": render(receipt)})

    @extend_schema(responses=DenominationSerializer)
    @action(detail=False, methods=["get"])
    def denominations(self, request) -> Response:
        """Denominaciones válidas para capturar el arqueo."""
        return Response(DenominationSerializer(DenominationSerializer.current()).data)


class CashMovementViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = CashMovement.objects.select_related("shift", "performed_by", "expense")
    serializer_class = CashMovementSerializer
    filterset_fields = ["shift", "direction", "reason"]
    ordering_fields = ["created_at", "amount"]


class ExpenseViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Expense.objects.select_related("shift", "requested_by", "reviewed_by")
    serializer_class = ExpenseSerializer
    required_permissions = {
        "create": [PermissionCode.EXPENSE_REGISTER],
        "review": [PermissionCode.EXPENSE_APPROVE],
        "pending": [PermissionCode.EXPENSE_APPROVE],
        "totals": [PermissionCode.REPORT_VIEW],
    }
    filterset_fields = ["status", "category", "shift", "requires_approval"]
    search_fields = ["folio", "description", "supplier"]
    ordering_fields = ["created_at", "amount"]

    @extend_schema(request=ExpenseInputSerializer, responses=ExpenseSerializer)
    def create(self, request) -> Response:
        serializer = ExpenseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = services.register_expense(actor=request.user, **serializer.validated_data)
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=ExpenseReviewSerializer, responses=ExpenseSerializer)
    @action(detail=True, methods=["post"])
    def review(self, request, pk=None) -> Response:
        """Aprueba o rechaza un gasto por encima del umbral."""
        serializer = ExpenseReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = services.review_expense(
            expense_id=int(pk), actor=request.user, **serializer.validated_data
        )
        return Response(ExpenseSerializer(expense).data)

    @extend_schema(responses=ExpenseSerializer(many=True))
    @action(detail=False, methods=["get"])
    def pending(self, request) -> Response:
        queryset = self.get_queryset().filter(status=ExpenseStatus.PENDING).order_by("created_at")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(ExpenseSerializer(page, many=True).data)

    @extend_schema(responses=None)
    @action(detail=False, methods=["get"], url_path="totals")
    def totals(self, request) -> Response:
        """Gasto aprobado por categoría (``?from=&to=`` sobre la fecha de creacion)."""
        queryset = self.get_queryset().filter(status=ExpenseStatus.APPROVED, is_active=True)
        desde = request.query_params.get("from")
        hasta = request.query_params.get("to")
        if desde:
            queryset = queryset.filter(created_at__date__gte=desde)
        if hasta:
            queryset = queryset.filter(created_at__date__lte=hasta)

        filas = queryset.values("category").annotate(total=Sum("amount")).order_by("-total")
        return Response(
            [{"category": fila["category"], "total": str(fila["total"])} for fila in filas]
        )

