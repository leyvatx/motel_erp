import { Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initials, roleTone, useTeamPresence, type TeamMember } from '@/features/users/presence'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

/** Traducción de la ruta que reporta el cliente en su ping. */
const SECTION_LABELS: Record<string, string> = {
  frontdesk: 'Recepción',
  housekeeping: 'Ama de llaves',
  inventory: 'Inventarios',
  finances: 'Finanzas',
  reports: 'Reportes',
  audit: 'Auditoría',
  users: 'Usuarios',
}

function Avatar({ member, size = 'sm' }: { member: TeamMember; size?: 'sm' | 'md' }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-background',
          size === 'sm' ? 'h-7 w-7 text-2xs' : 'h-8 w-8 text-xs',
          roleTone(member.role),
          !member.is_online && 'opacity-40 grayscale',
        )}
      >
        {initials(member.full_name)}
      </span>
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
          member.is_online ? 'bg-status-available' : 'bg-muted-foreground/40',
        )}
        aria-hidden
      />
    </span>
  )
}

/**
 * Quién está en línea.
 *
 * La presencia la reporta el WebSocket, así que refleja pestañas realmente
 * abiertas. Sirve para lo cotidiano del turno: saber si ya llegó el relevo o
 * si ama de llaves puede recibir una tarea ahora mismo.
 */
export function TeamPresence() {
  const { data, isLoading } = useTeamPresence()
  const currentUserId = useAuthStore((state) => state.user?.id)

  const members = data ?? []
  const online = members.filter((member) => member.is_online)
  const offline = members.filter((member) => !member.is_online)
  const visible = online.slice(0, 3)

  if (isLoading) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-2"
          aria-label={`Equipo: ${online.length} en línea`}
          title={`${online.length} en línea`}
        >
          {visible.length > 0 ? (
            <span className="flex -space-x-2">
              {visible.map((member) => (
                <Avatar key={member.user_id} member={member} />
              ))}
            </span>
          ) : (
            <Users className="text-muted-foreground" />
          )}
          <span className="hidden text-xs font-medium tabular text-muted-foreground md:block">
            {online.length}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between font-normal">
          <span className="text-sm font-medium">Equipo</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-status-available" aria-hidden />
            {online.length} en línea
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <ul className="max-h-80 overflow-y-auto scrollbar-thin py-1">
          {[...online, ...offline].map((member) => (
            <li
              key={member.user_id}
              className="flex items-center gap-2.5 px-2 py-1.5 text-sm transition-colors hover:bg-accent/60"
            >
              <Avatar member={member} size="md" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium">
                  {member.full_name}
                  {member.user_id === currentUserId ? (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">(tú)</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.role_display}
                  {member.is_online && member.last_section ? (
                    <span> · en {SECTION_LABELS[member.last_section] ?? member.last_section}</span>
                  ) : null}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-2xs',
                  member.is_online ? 'font-medium text-status-available' : 'text-muted-foreground',
                )}
              >
                {member.is_online
                  ? 'En línea'
                  : member.last_seen_at
                    ? `Activo ${formatRelative(member.last_seen_at)}`
                    : 'Nunca ha entrado'}
              </span>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
