from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.corporate.models import CorporateAccess, MotelGroup, MotelRegion, RegionMotel
from apps.corporate.serializers import (
    AccessibleMotelSerializer, AssignMotelsSerializer, BulkConfigSerializer,
    CorporateAccessSerializer, CorporateUserSerializer, MotelGroupSerializer,
    MotelRegionSerializer, RegionMotelSerializer,
)
from apps.corporate.services import access_role, accessible_motel_ids
from apps.notifications.events import Event, broadcast
from apps.rooms.constants import RoomStatus
from apps.rooms.models import Room
from apps.sales.constants import PaymentStatus
from apps.sales.models import Payment
from apps.settings.models import Motel
from apps.settings.serializers import MotelSerializer
from apps.users.constants import PermissionCode
from apps.users.models import User


class CorporateScopeMixin:
    allow_corporate_scope = True
    allow_platform_scope = True
    required_permissions = {
        "read": [PermissionCode.CORPORATE_VIEW],
        "write": [PermissionCode.CORPORATE_MANAGE],
    }

    def accessible_ids(self):
        return accessible_motel_ids(self.request.user)

    def can_manage_all(self):
        return self.request.user.is_platform_admin


class GroupViewSet(CorporateScopeMixin, viewsets.ModelViewSet):
    serializer_class = MotelGroupSerializer
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "created_at"]

    def get_queryset(self):
        queryset = MotelGroup.objects
        if not self.can_manage_all():
            queryset = queryset.filter(
                regions__memberships__motel_id__in=self.accessible_ids(),
                regions__memberships__is_active=True,
            ).distinct()
        return queryset.annotate(
            region_count=Count("regions", filter=Q(regions__is_active=True), distinct=True),
            motel_count=Count(
                "regions__memberships",
                filter=Q(regions__is_active=True, regions__memberships__is_active=True),
                distinct=True,
            ),
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)


class RegionViewSet(CorporateScopeMixin, viewsets.ModelViewSet):
    serializer_class = MotelRegionSerializer
    filterset_fields = ["group"]
    search_fields = ["code", "name", "group__name"]

    def get_queryset(self):
        queryset = MotelRegion.objects.select_related("group")
        if not self.can_manage_all():
            queryset = queryset.filter(
                memberships__motel_id__in=self.accessible_ids(), memberships__is_active=True
            ).distinct()
        return queryset.annotate(
            motel_count=Count("memberships", filter=Q(memberships__is_active=True), distinct=True)
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=True, methods=["get", "put"], url_path="motels")
    def motels(self, request, pk=None):
        region = self.get_object()
        if request.method == "GET":
            items = RegionMotel.objects.filter(region=region).select_related("motel", "region__group")
            return Response(RegionMotelSerializer(items, many=True).data)

        payload = AssignMotelsSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        wanted = set(payload.validated_data["motel_ids"])
        if not request.user.is_platform_admin and wanted - accessible_motel_ids(request.user):
            return Response(
                {"error": {"code": "outside_scope", "message": "Hay moteles fuera de tu alcance."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        with transaction.atomic():
            current = RegionMotel.all_objects.select_for_update().filter(region=region)
            for membership in current:
                if membership.motel_id not in wanted and membership.is_active:
                    membership.soft_delete(user=request.user)
            for motel_id in wanted:
                membership = RegionMotel.all_objects.filter(motel_id=motel_id).first()
                if membership:
                    membership.region = region
                    membership.is_active = True
                    membership.deleted_at = None
                    membership.deleted_by = None
                    membership.updated_by = request.user
                    membership.save()
                else:
                    RegionMotel.objects.create(
                        region=region, motel_id=motel_id,
                        created_by=request.user, updated_by=request.user,
                    )
        items = RegionMotel.objects.filter(region=region).select_related("motel", "region__group")
        return Response(RegionMotelSerializer(items, many=True).data)


class CorporateUserViewSet(CorporateScopeMixin, viewsets.ModelViewSet):
    serializer_class = CorporateUserSerializer
    search_fields = ["username", "full_name", "email"]

    def get_queryset(self):
        queryset = User.all_objects.filter(motel__isnull=True, is_superuser=False)
        if not self.request.user.is_platform_admin:
            ids = self.accessible_ids()
            queryset = queryset.filter(
                Q(pk=self.request.user.pk)
                | Q(corporate_accesses__motel_id__in=ids, corporate_accesses__is_active=True)
                | Q(
                    corporate_accesses__region__memberships__motel_id__in=ids,
                    corporate_accesses__region__memberships__is_active=True,
                    corporate_accesses__is_active=True,
                )
            ).distinct()
        return queryset.order_by("full_name")

    def perform_create(self, serializer):
        region = serializer.validated_data.get("region")
        if not self.request.user.is_platform_admin:
            target_ids = set(RegionMotel.objects.filter(region=region).values_list("motel_id", flat=True))
            if not target_ids or target_ids - self.accessible_ids():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("No puedes crear usuarios fuera de tus regiones.")
        serializer.save()

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)


class AccessViewSet(CorporateScopeMixin, viewsets.ModelViewSet):
    serializer_class = CorporateAccessSerializer
    filterset_fields = ["user", "region", "motel", "role"]

    def get_queryset(self):
        queryset = CorporateAccess.objects.select_related("user", "region", "motel")
        if not self.request.user.is_platform_admin:
            ids = self.accessible_ids()
            queryset = queryset.filter(
                Q(motel_id__in=ids) | Q(region__memberships__motel_id__in=ids)
            ).distinct()
        return queryset

    def perform_create(self, serializer):
        self._validate_scope(serializer.validated_data)
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        self._validate_scope(serializer.validated_data, serializer.instance)
        serializer.save(updated_by=self.request.user)

    def _validate_scope(self, data, instance=None):
        if self.request.user.is_platform_admin:
            return
        region = data.get("region", getattr(instance, "region", None))
        motel = data.get("motel", getattr(instance, "motel", None))
        allowed = self.accessible_ids()
        target_ids = {motel.pk} if motel else set(
            RegionMotel.objects.filter(region=region).values_list("motel_id", flat=True)
        )
        if not target_ids or target_ids - allowed:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No puedes asignar accesos fuera de tus propiedades.")

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)


class AccessibleMotelsView(CorporateScopeMixin, APIView):
    def get(self, request):
        ids = accessible_motel_ids(request.user)
        motels = Motel.objects.filter(pk__in=ids).select_related(
            "corporate_membership__region__group"
        ).order_by("name")
        data = []
        for motel in motels:
            membership = getattr(motel, "corporate_membership", None)
            region = membership.region if membership and membership.is_active else None
            data.append({
                "id": motel.pk, "slug": motel.slug, "name": motel.name,
                "group_id": region.group_id if region else None,
                "group_name": region.group.name if region else None,
                "region_id": region.pk if region else None,
                "region_name": region.name if region else None,
                "access_role": access_role(request.user, motel.pk) if not request.user.is_platform_admin else "SUPERADMIN",
            })
        return Response(AccessibleMotelSerializer(data, many=True).data)


class CorporateDashboardView(CorporateScopeMixin, APIView):
    def get(self, request):
        ids = accessible_motel_ids(request.user)
        since = timezone.now() - timezone.timedelta(hours=24)
        room_rows = Room.all_objects.filter(motel_id__in=ids, is_active=True).values("motel_id").annotate(
            rooms=Count("id"), occupied=Count("id", filter=Q(status=RoomStatus.OCCUPIED))
        )
        payment_rows = Payment.all_objects.filter(
            motel_id__in=ids, is_active=True, status=PaymentStatus.APPLIED, paid_at__gte=since
        ).values("motel_id").annotate(revenue=Sum("amount"))
        rooms = {row["motel_id"]: row for row in room_rows}
        revenue = {row["motel_id"]: row["revenue"] or Decimal("0") for row in payment_rows}
        motels = Motel.objects.filter(pk__in=ids).select_related(
            "corporate_membership__region__group"
        ).order_by("name")
        rows = []
        for motel in motels:
            stats = rooms.get(motel.pk, {"rooms": 0, "occupied": 0})
            membership = getattr(motel, "corporate_membership", None)
            region = membership.region if membership and membership.is_active else None
            total = stats["rooms"]
            rows.append({
                "motel_id": motel.pk, "motel_name": motel.name,
                "group_name": region.group.name if region else None,
                "region_name": region.name if region else None,
                "rooms": total, "occupied": stats["occupied"],
                "occupancy_rate": round(stats["occupied"] * 100 / total, 1) if total else 0,
                "revenue_24h": revenue.get(motel.pk, Decimal("0")),
            })
        return Response({
            "generated_at": timezone.now(), "period_hours": 24,
            "totals": {
                "groups": len({row["group_name"] for row in rows if row["group_name"]}),
                "regions": len({(row["group_name"], row["region_name"]) for row in rows if row["region_name"]}),
                "motels": len(rows), "rooms": sum(row["rooms"] for row in rows),
                "occupied": sum(row["occupied"] for row in rows),
                "revenue_24h": sum((row["revenue_24h"] for row in rows), Decimal("0")),
            },
            "motels": rows,
        })


class BulkConfigView(CorporateScopeMixin, APIView):
    required_permissions = {"*": [PermissionCode.CORPORATE_MANAGE]}

    def post(self, request):
        payload = BulkConfigSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        if data.get("region_id"):
            target_ids = set(RegionMotel.objects.filter(
                region_id=data["region_id"]
            ).values_list("motel_id", flat=True))
        else:
            target_ids = set(data["motel_ids"])
        allowed = accessible_motel_ids(request.user)
        forbidden = target_ids - allowed
        if forbidden:
            return Response(
                {"error": {"code": "outside_scope", "message": "Hay moteles fuera de tu alcance.", "motel_ids": sorted(forbidden)}},
                status=status.HTTP_403_FORBIDDEN,
            )
        targets = list(Motel.objects.filter(pk__in=target_ids).order_by("name"))
        if len(targets) != len(target_ids):
            return Response(
                {"error": {"code": "invalid_targets", "message": "Uno o más moteles no existen o están suspendidos."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        validated = []
        for motel in targets:
            serializer = MotelSerializer(
                motel, data=data["changes"], partial=True, context={"request": request}
            )
            serializer.is_valid(raise_exception=True)
            validated.append((motel, serializer.validated_data))
        result = {
            "dry_run": data["dry_run"], "target_count": len(targets),
            "targets": [{"id": item.pk, "name": item.name} for item in targets],
            "changes": data["changes"],
        }
        if data["dry_run"]:
            return Response(result)
        with transaction.atomic():
            locked = {m.pk: m for m in Motel.all_objects.select_for_update().filter(pk__in=target_ids)}
            for motel, changes in validated:
                serializer = MotelSerializer(
                    locked[motel.pk], data=changes, partial=True, context={"request": request}
                )
                serializer.is_valid(raise_exception=True)
                updated = serializer.save()
                broadcast(Event.SETTINGS_CHANGED, {"motel_id": updated.pk}, motel=updated)
        result["applied"] = True
        return Response(result)
