import { PiBell, PiChecks } from 'react-icons/pi'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMarkAllRead, useNotifications, useUnreadCount } from '@/features/notifications/hooks'
import type { Notification } from '@/features/notifications/api'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const LEVEL_STYLES: Record<Notification['level'], string> = {
  INFO: 'bg-brand-accent',
  WARNING: 'bg-status-cleaning',
  CRITICAL: 'bg-status-occupied',
}

function NotificationRow({ item }: { item: Notification }) {
  return (
    <li
      className={cn(
        'flex gap-3 border-b px-4 py-3 last:border-b-0',
        !item.is_read && 'bg-accent/40',
      )}
    >
      <span
        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', LEVEL_STYLES[item.level])}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        {item.body ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(item.created_at)}</p>
      </div>
    </li>
  )
}

export function NotificationBell() {
  const { data: counter } = useUnreadCount()
  const { data, isLoading } = useNotifications({ page_size: 12 })
  const markAllRead = useMarkAllRead()

  const unread = counter?.unread ?? 0
  const critical = (counter?.critical ?? 0) > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <PiBell className="h-5 w-5" />
          {unread > 0 ? (
            <Badge
              className={cn(
                'absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]',
                critical ? 'bg-status-occupied' : 'bg-brand-accent',
                critical && 'animate-pulse-alert',
              )}
            >
              {unread > 99 ? '99+' : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              loading={markAllRead.isPending}
            >
              <PiChecks className="h-4 w-4" />
              Marcar leidas
            </Button>
          ) : null}
        </div>

        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : data && data.results.length > 0 ? (
            <ul>
              {data.results.map((item) => (
                <NotificationRow key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay avisos pendientes.
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
