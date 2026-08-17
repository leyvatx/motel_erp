"""Servicio de notificaciones: persiste el aviso y lo empuja en tiempo real."""

from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.notifications.events import (
    GROUP_NOTIFICATIONS,
    Event,
    broadcast,
    notification_payload,
    role_group,
    user_group,
)
from apps.notifications.models import Notification, NotificationCategory, NotificationLevel
from apps.users.constants import Role


@transaction.atomic
def notify(
    *,
    category: str,
    title: str,
    body: str = "",
    level: str = NotificationLevel.INFO,
    target_role: str = "",
    target_user=None,
    payload: dict[str, Any] | None = None,
    actor=None,
) -> Notification:
    """Crea el aviso y lo publica al grupo que corresponda.

    ``target_role`` vacio significa "todos los roles": el aviso viaja al grupo
    general del topbar.
    """
    notification = Notification.objects.create(
        category=category,
        level=level,
        title=title[:120],
        body=body[:255],
        target_role=target_role,
        target_user=target_user,
        payload=payload or {},
        created_by=actor,
    )

    groups = [GROUP_NOTIFICATIONS]
    if target_role:
        groups = [role_group(target_role)]
    if target_user is not None:
        groups = [user_group(target_user.pk)]

    broadcast(Event.NOTIFICATION_NEW, notification_payload(notification), groups=groups)
    return notification


def notify_management(
    *, category: str, title: str, body: str = "", level: str = NotificationLevel.WARNING, **kwargs
) -> list[Notification]:
    """Avisa a gerencia y a super administración."""
    return [
        notify(category=category, title=title, body=body, level=level, target_role=role, **kwargs)
        for role in (Role.MANAGER, Role.SUPERADMIN)
    ]


def mark_read(*, notification_ids: list[int], user) -> int:
    """Marca avisos como leidos para el usuario que los atendio."""
    from django.utils import timezone

    return Notification.objects.filter(pk__in=notification_ids, read_at__isnull=True).update(
        read_at=timezone.now(), read_by=user
    )


def unread_for(user) -> "list[Notification]":
    """Avisos pendientes visibles para el rol del usuario."""
    from django.db.models import Q

    return list(
        Notification.objects.filter(read_at__isnull=True, is_active=True)
        .filter(Q(target_role="") | Q(target_role=user.role) | Q(target_user=user))
        .order_by("-created_at")
    )


__all__ = [
    "NotificationCategory",
    "NotificationLevel",
    "mark_read",
    "notify",
    "notify_management",
    "unread_for",
]
