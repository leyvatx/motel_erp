import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/axios'
import type { IsoDateTime, Role } from '@/types/api'

export interface TeamMember {
  user_id: number
  username: string
  full_name: string
  role: Role
  role_display: string
  is_online: boolean
  last_seen_at: IsoDateTime | null
  last_section: string
}

export const teamKeys = {
  roster: ['users', 'team'] as const,
}

export function useTeamPresence() {
  return useQuery({
    queryKey: teamKeys.roster,
    queryFn: () => get<TeamMember[]>('/auth/team/'),
    // El evento `presence.changed` refresca esto al instante; el intervalo
    // solo cubre el caso de un socket caído sin aviso.
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}

/** Iniciales para el avatar, sin depender de imágenes. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : (parts[0]?.[1] ?? '')
  return `${first}${second}`.toUpperCase()
}

/** Color estable por rol: el mismo empleado siempre se ve igual. */
export function roleTone(role: Role): string {
  const tones: Record<Role, string> = {
    SUPERADMIN: 'bg-violet-500',
    MANAGER: 'bg-brand-accent',
    RECEPTION: 'bg-emerald-500',
    HOUSEKEEPING: 'bg-amber-500',
  }
  return tones[role]
}
