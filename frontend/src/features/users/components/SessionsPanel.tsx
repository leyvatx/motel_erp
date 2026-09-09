import { useMemo, useState } from 'react'
import { PiDesktop, PiDeviceMobile, PiPower, PiShieldCheck, PiWarningCircle } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { StatStrip } from '@/components/layout/StatStrip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useRevokeSession, useSessions } from '@/features/users/hooks'
import type { UserSession } from '@/features/users/types'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Un teléfono no se cierra con el mismo criterio que la computadora de
 *  recepción: el icono es lo primero que se mira para decidir si una sesión
 *  sobra. */
function iconoDe(session: UserSession) {
  const movil = /iPhone|iPad|Android/i.test(session.user_agent)
  return movil ? PiDeviceMobile : PiDesktop
}

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

function Fila({
  session,
  onRevoke,
}: {
  session: UserSession
  onRevoke: (session: UserSession) => void
}) {
  const Icono = iconoDe(session)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-4 py-3.5 transition-colors sm:flex-row sm:items-center sm:gap-4',
        'hover:bg-muted/40',
        session.is_current && 'bg-primary/[0.03]',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
        {iniciales(session.user_full_name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-medium leading-none">{session.user_full_name}</p>
          {session.is_current ? (
            <Badge variant="secondary" className="text-2xs">
              Este equipo
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {session.user_role_display} · @{session.user_username}
        </p>
      </div>

      <div className="min-w-0 sm:w-52">
        <p className="flex items-center gap-1.5 truncate text-xs text-foreground/80">
          <Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {session.device}
        </p>
        <p className="mt-1 truncate font-mono text-2xs text-muted-foreground">
          {session.ip_address ?? 'Origen desconocido'}
        </p>
      </div>

      <div className="sm:w-44">
        <p className="flex items-center gap-1.5 text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-available" aria-hidden />
          <span className="truncate text-foreground/80">
            Activa {formatRelative(session.last_seen_at ?? session.created_at)}
          </span>
        </p>
        <p className="mt-1 truncate text-2xs text-muted-foreground">
          Inició {formatDateTime(session.created_at)}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRevoke(session)}
        className="shrink-0 self-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-center"
      >
        <PiPower />
        Cerrar
      </Button>
    </div>
  )
}

export function SessionsPanel() {
  const { t } = useTranslation()
  const { data, isPending } = useSessions()
  const revoke = useRevokeSession()
  const [porCerrar, setPorCerrar] = useState<UserSession | null>(null)

  const sesiones = useMemo(() => data?.results ?? [], [data])

  const resumen = useMemo(() => {
    const personas = new Set(sesiones.map((sesion) => sesion.user))
    const equipos = new Set(sesiones.map((sesion) => sesion.ip_address ?? sesion.sid))
    const masVieja = sesiones.reduce<string | null>(
      (vieja, sesion) => (!vieja || sesion.created_at < vieja ? sesion.created_at : vieja),
      null,
    )
    return { personas: personas.size, equipos: equipos.size, masVieja }
  }, [sesiones])

  const confirmar = (): void => {
    if (!porCerrar) return
    revoke.mutate(porCerrar.sid, { onSuccess: () => setPorCerrar(null) })
  }

  const nombrePorCerrar = porCerrar?.user_full_name ?? ''

  return (
    <div className="space-y-4 pb-4">
      <StatStrip
        isLoading={isPending}
        stats={[
          { label: 'Sesiones abiertas', value: sesiones.length },
          { label: 'Personas', value: resumen.personas, help: t('usuarios.conAlMenosUnaSesion') },
          {
            label: 'Equipos distintos',
            value: resumen.equipos,
            help: t('usuarios.porDireccionIp'),
          },
          {
            label: t('usuarios.laMasAntigua'),
            value: resumen.masVieja ? formatRelative(resumen.masVieja) : '—',
            help: t('usuarios.desdeQueInicio'),
          },
        ]}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <PiShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{t('usuarios.quienEstaDentro')}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Cerrar una sesión la corta al instante, no cuando venza su token.
          </p>
        </div>

        {isPending ? (
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, indice) => (
              <div key={indice} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : sesiones.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <PiShieldCheck className="mx-auto h-7 w-7 text-muted-foreground/50" aria-hidden />
            <p className="mt-3 text-sm font-medium">{t('usuarios.sinSesionAbierta')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aparecerán aquí en cuanto alguien entre al sistema.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {sesiones.map((session) => (
              <Fila key={session.sid} session={session} onRevoke={setPorCerrar} />
            ))}
          </div>
        )}
      </Card>

      <Dialog open={porCerrar !== null} onOpenChange={(abierto) => !abierto && setPorCerrar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                <PiWarningCircle className="h-4 w-4 text-destructive" aria-hidden />
              </span>
              ¿Cerrar esta sesión?
            </DialogTitle>
            <DialogDescription>
              {porCerrar?.is_current
                ? t('usuarios.esLaSesionDeEsteEquipo')
                : `${nombrePorCerrar} dejará de operar en su siguiente acción y tendrá que iniciar sesión otra vez.`}
            </DialogDescription>
          </DialogHeader>

          {porCerrar ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs">
              <p className="font-medium">{porCerrar.device}</p>
              <p className="mt-0.5 font-mono text-muted-foreground">
                {porCerrar.ip_address ?? 'Origen desconocido'}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPorCerrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" loading={revoke.isPending} onClick={confirmar}>
              <PiPower />
              Cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
