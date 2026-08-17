"""API de folios, consumos y cobro."""

from __future__ import annotations

from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers as drf_serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.sales import services
from apps.sales.constants import ChargeType, FolioStatus, FolioType
from apps.sales.models import Folio, FolioCharge, Order, OrderItem, Payment
from apps.users.constants import PermissionCode
from apps.sales.serializers import (
    CreateOrderSerializer,
    DiscountInputSerializer,
    FolioListSerializer,
    FolioSerializer,
    OrderSerializer,
    PaymentInputSerializer,
    PaymentSerializer,
    ReasonSerializer,
)


class ManualChargeSerializer(drf_serializers.Serializer):
    """Cargo manual: servicios, recargos o ajustes capturados por recepción."""

    charge_type = drf_serializers.ChoiceField(
        choices=[
            (ChargeType.SERVICE, ChargeType.SERVICE.label),
            (ChargeType.SURCHARGE, ChargeType.SURCHARGE.label),
            (ChargeType.ADJUSTMENT, ChargeType.ADJUSTMENT.label),
        ]
    )
    description = drf_serializers.CharField(max_length=180)
    unit_price = drf_serializers.DecimalField(max_digits=12, decimal_places=2)
    quantity = drf_serializers.DecimalField(max_digits=10, decimal_places=3, default=1)


class OpenCounterFolioSerializer(drf_serializers.Serializer):
    notes = drf_serializers.CharField(required=False, allow_blank=True, max_length=500)


def folio_detail_queryset():
    """Folio con cargos, pagos y ordenes precargados (sin N+1)."""
    return (
        Folio.objects.select_related("stay", "room", "closed_by")
        .prefetch_related(
            Prefetch("charges", queryset=FolioCharge.objects.order_by("created_at")),
            Prefetch("payments", queryset=Payment.objects.select_related("received_by")),
            Prefetch(
                "orders",
                queryset=Order.objects.select_related("warehouse").prefetch_related(
                    Prefetch("items", queryset=OrderItem.objects.select_related("product"))
                ),
            ),
        )
    )


class FolioViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Folio.objects.select_related("stay", "room")
    serializer_class = FolioSerializer
    required_permissions = {
        "open_counter": [PermissionCode.FOLIO_CHARGE],
        "add_charge": [PermissionCode.FOLIO_CHARGE],
        "cancel_charge": [PermissionCode.FOLIO_VOID],
        "discount": [PermissionCode.FOLIO_DISCOUNT],
        "payment": [PermissionCode.PAYMENT_REGISTER],
        "close": [PermissionCode.PAYMENT_REGISTER],
        "cancel": [PermissionCode.FOLIO_VOID],
        "print_ticket": [PermissionCode.FOLIO_CHARGE],
    }
    filterset_fields = ["status", "folio_type", "room"]
    search_fields = ["code", "room__number", "stay__code", "stay__vehicle_plate"]
    ordering_fields = ["opened_at", "closed_at", "total"]

    def get_serializer_class(self):
        return FolioListSerializer if self.action == "list" else FolioSerializer

    def get_queryset(self):
        if self.action in {"list"}:
            return super().get_queryset()
        return folio_detail_queryset()

    @extend_schema(request=OpenCounterFolioSerializer, responses=FolioSerializer)
    @action(detail=False, methods=["post"], url_path="open-counter")
    def open_counter(self, request) -> Response:
        """Abre una cuenta de mostrador (venta POS sin habitación)."""
        serializer = OpenCounterFolioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        folio = services.open_folio(
            actor=request.user,
            folio_type=FolioType.COUNTER,
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(
            FolioSerializer(folio_detail_queryset().get(pk=folio.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=ManualChargeSerializer, responses=FolioSerializer)
    @action(detail=True, methods=["post"], url_path="charges")
    def add_charge(self, request, pk=None) -> Response:
        serializer = ManualChargeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        folio = services.lock_folio(int(pk))
        services.add_charge(folio=folio, actor=request.user, **serializer.validated_data)
        return Response(FolioSerializer(folio_detail_queryset().get(pk=pk)).data)

    @extend_schema(
        request=ReasonSerializer,
        responses=FolioSerializer,
        parameters=[
            OpenApiParameter(
                "charge_id", int, OpenApiParameter.PATH, description="Id del cargo a cancelar."
            )
        ],
    )
    @action(detail=True, methods=["post"], url_path="charges/(?P<charge_id>[^/.]+)/cancel")
    def cancel_charge(self, request, pk=None, charge_id=None) -> Response:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.cancel_charge(
            charge_id=int(charge_id),
            reason=serializer.validated_data["reason"],
            actor=request.user,
        )
        return Response(FolioSerializer(folio_detail_queryset().get(pk=pk)).data)

    @extend_schema(request=DiscountInputSerializer, responses=FolioSerializer)
    @action(detail=True, methods=["post"])
    def discount(self, request, pk=None) -> Response:
        serializer = DiscountInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.apply_discount(folio_id=int(pk), actor=request.user, **serializer.validated_data)
        return Response(FolioSerializer(folio_detail_queryset().get(pk=pk)).data)

    @extend_schema(request=PaymentInputSerializer, responses=FolioSerializer)
    @action(detail=True, methods=["post"])
    def payment(self, request, pk=None) -> Response:
        serializer = PaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.register_payment(folio_id=int(pk), actor=request.user, **serializer.validated_data)
        return Response(FolioSerializer(folio_detail_queryset().get(pk=pk)).data)

    @extend_schema(request=None, responses=FolioSerializer)
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None) -> Response:
        """Cierra la cuenta. Exige saldo cero."""
        services.close_folio(folio_id=int(pk), actor=request.user)
        return Response(FolioSerializer(folio_detail_queryset().get(pk=pk)).data)

    @extend_schema(request=ReasonSerializer, responses=FolioSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None) -> Response:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.cancel_folio(
            folio_id=int(pk), reason=serializer.validated_data["reason"], actor=request.user
        )
        return Response(FolioSerializer(folio_detail_queryset().get(pk=pk)).data)

    @extend_schema(request=None, responses={200: None})
    @action(detail=True, methods=["post"], url_path="print-ticket")
    def print_ticket(self, request, pk=None) -> Response:
        """Emite (o reimprime) el ticket de la cuenta en la termica."""
        from apps.sales.receipts import emit_folio_receipt, render

        folio = self.get_object()
        ya_impreso = folio.receipts.filter(is_active=True).exists()
        receipt = emit_folio_receipt(
            folio=folio, actor=request.user, is_reprint=ya_impreso
        )
        return Response(
            {
                "receipt_id": receipt.pk,
                "is_reprint": receipt.is_reprint,
                "preview": render(receipt),
            }
        )

    @extend_schema(responses=FolioSerializer)
    @action(detail=False, methods=["get"], url_path="open")
    def open_folios(self, request) -> Response:
        """Cuentas abiertas: lo que recepción tiene pendiente de cobrar."""
        queryset = self.queryset.filter(status=FolioStatus.OPEN).order_by("-opened_at")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(FolioListSerializer(page, many=True).data)


class OrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Order.objects.select_related("folio", "warehouse", "delivered_by").prefetch_related(
        Prefetch("items", queryset=OrderItem.objects.select_related("product"))
    )
    serializer_class = OrderSerializer
    required_permissions = {
        "create": [PermissionCode.FOLIO_CHARGE],
        "deliver": [PermissionCode.FOLIO_CHARGE],
        "cancel": [PermissionCode.FOLIO_VOID],
        "cancel_item": [PermissionCode.FOLIO_VOID],
    }
    filterset_fields = ["status", "order_type", "folio", "warehouse"]
    search_fields = ["code", "folio__code"]
    ordering_fields = ["placed_at", "total"]

    @extend_schema(request=CreateOrderSerializer, responses=OrderSerializer)
    def create(self, request) -> Response:
        """Alta de consumo: descuenta inventario y lo carga al folio."""
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.create_order(actor=request.user, **serializer.validated_data)
        return Response(
            OrderSerializer(self.get_queryset().get(pk=order.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=None, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def deliver(self, request, pk=None) -> Response:
        services.mark_order_delivered(order_id=int(pk), actor=request.user)
        return Response(OrderSerializer(self.get_queryset().get(pk=pk)).data)

    @extend_schema(request=ReasonSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None) -> Response:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.cancel_order(
            order_id=int(pk), reason=serializer.validated_data["reason"], actor=request.user
        )
        return Response(OrderSerializer(self.get_queryset().get(pk=pk)).data)

    @extend_schema(
        request=ReasonSerializer,
        responses=OrderSerializer,
        parameters=[
            OpenApiParameter(
                "item_id", int, OpenApiParameter.PATH, description="Id del renglón a cancelar."
            )
        ],
    )
    @action(detail=True, methods=["post"], url_path="items/(?P<item_id>[^/.]+)/cancel")
    def cancel_item(self, request, pk=None, item_id=None) -> Response:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.cancel_order_item(
            item_id=int(item_id),
            reason=serializer.validated_data["reason"],
            actor=request.user,
        )
        return Response(OrderSerializer(self.get_queryset().get(pk=pk)).data)


class PaymentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Payment.objects.select_related("folio", "received_by")
    serializer_class = PaymentSerializer
    required_permissions = {"void": [PermissionCode.FOLIO_VOID]}
    filterset_fields = ["method", "status", "folio"]
    ordering_fields = ["paid_at", "amount"]

    @extend_schema(request=ReasonSerializer, responses=PaymentSerializer)
    @action(detail=True, methods=["post"])
    def void(self, request, pk=None) -> Response:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = services.void_payment(
            payment_id=int(pk), reason=serializer.validated_data["reason"], actor=request.user
        )
        return Response(PaymentSerializer(payment).data)
