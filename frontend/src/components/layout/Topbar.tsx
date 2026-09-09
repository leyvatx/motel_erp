import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import {
  PiKey,
  PiList,
  PiMoon,
  PiSignOut,
  PiSpeakerHigh,
  PiSpeakerSlash,
  PiCheck,
  PiSun,
  PiTranslate,
} from 'react-icons/pi'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { ShiftChip } from '@/features/finances/components/ShiftChip'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { TeamPresence } from '@/features/users/TeamPresence'
import { StayDetailDialog } from '@/features/frontdesk/components/StayDetailDialog'
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog'
import { useLogout } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'
import { useAppearanceStore } from '@/store/appearance'
import { useAuthStore } from '@/store/auth'
import { cambiarIdioma, idiomaActual, IDIOMAS } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { realtimeChannels } from '@/lib/websocket'
import { useUiStore } from '@/store/ui'
import type { ConnectionState } from '@/types/realtime'

interface Props {
  connection: ConnectionState
  onOpenMenu: () => void
}

export function Topbar({ connection, onOpenMenu }: Props) {
  const user = useAuthStore((state) => state.user)
  const soundAlerts = useUiStore((state) => state.soundAlerts)
  const setSoundAlerts = useUiStore((state) => state.setSoundAlerts)
  const setTheme = useAppearanceStore((state) => state.setTheme)
  const logout = useLogout()

  const { t } = useTranslation()
  // Lo que hay en pantalla ahora, que no siempre es lo que dice la preferencia.
  const [modoEnPantalla, setModoEnPantalla] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  useEffect(() => {
    const observador = new MutationObserver(() =>
      setModoEnPantalla(document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
    )
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observador.disconnect()
  }, [])

  const [stayId, setStayId] = useState<number | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const online = connection === 'open'
  const platform = Boolean(user?.is_platform_admin)
  const corporate = Boolean(user?.is_corporate_user)
  const activeMotelId = useAuthStore((state) => state.activeMotelId)
  const activeMotelName = useAuthStore((state) => state.activeMotelName)
  const clearActiveMotel = useAuthStore((state) => state.clearActiveMotel)
  const operational = !platform && (!corporate || Boolean(activeMotelId))
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.must_change_password) setPasswordOpen(true)
  }, [user?.must_change_password])

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-1 border-b bg-background px-2 sm:gap-2 sm:px-3 lg:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 lg:hidden"
        onClick={onOpenMenu}
        aria-label="Abrir menú"
      >
        <PiList className="h-5 w-5" />
      </Button>

      {operational ? <GlobalSearch onSelectStay={setStayId} /> : null}

      {corporate && activeMotelName ? (
        <Button
          variant="outline"
          size="sm"
          className="hidden max-w-52 sm:flex"
          onClick={() => {
            clearActiveMotel()
            queryClient.clear()
            navigate('/corporate')
          }}
        >
          {activeMotelName} · Volver
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-0.5">
        {operational ? (
          <>
            <ShiftChip />

            {/* Qué significa cada estado, dicho sin asustar.
                "Reconectando" eterno se lee como "el sistema está caído" y no
                lo está: se puede rentar, cobrar y capturar igual. Cuando el
                tiempo real se da por vencido, el chip dice qué se pierde --
                que los cambios de otras terminales ya no llegan solos -- y
                ofrece volver a intentarlo. */}
            <button
              type="button"
              onClick={() => realtimeChannels.forEach((canal) => canal.reintentar())}
              disabled={connection !== 'degradado'}
              className={cn(
                'mx-1.5 hidden items-center gap-1.5 rounded-full border px-2 py-1 text-2xs font-medium sm:flex',
                connection === 'degradado'
                  ? 'text-muted-foreground hover:bg-accent'
                  : 'cursor-default text-muted-foreground',
              )}
              title={
                online
                  ? 'Conectado en tiempo real'
                  : connection === 'degradado'
                    ? 'Sin tiempo real. La operación sigue normal; los cambios de otras terminales tardan en aparecer. Toca para reintentar.'
                    : 'Reconectando al servidor'
              }
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  online && 'bg-status-available',
                  connection === 'degradado' && 'bg-muted-foreground/50',
                  !online && connection !== 'degradado' && 'animate-pulse-alert bg-status-cleaning',
                )}
                aria-hidden
              />
              {online
                ? 'En línea'
                : connection === 'degradado'
                  ? 'Sin tiempo real'
                  : 'Reconectando'}
            </button>

            {/* Sonido y tema son ajustes, no operación: en 375 px la franja
                no da para nueve controles y acababa cortando el menú del
                usuario. Abajo de `sm` viven dentro de ese menú. */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden h-11 w-11 sm:inline-flex lg:h-8 lg:w-8"
              onClick={() => setSoundAlerts(!soundAlerts)}
              aria-label={soundAlerts ? 'Silenciar alertas' : 'Activar alertas sonoras'}
              title={soundAlerts ? 'Alertas sonoras activas' : 'Alertas sonoras silenciadas'}
            >
              {soundAlerts ? (
                <PiSpeakerHigh />
              ) : (
                <PiSpeakerSlash className="text-muted-foreground" />
              )}
            </Button>
          </>
        ) : null}

        {/* El mismo control que la portada, no uno parecido: así el icono
            dice siempre lo que hay en pantalla. El de antes miraba la
            preferencia y no el resultado, y con una sucursal configurada en
            oscuro el primer clic volvía a poner oscuro -- clic sin efecto. */}
        <span className="hidden sm:contents">
          <ThemeToggle />
          <LanguageToggle />
        </span>

        {operational ? (
          <>
            <NotificationBell />
            <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
            <span className="hidden sm:contents">
              <TeamPresence />
            </span>
            <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          </>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-11 gap-2 px-1.5 lg:h-9">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-2xs font-semibold text-secondary-foreground">
                {user?.full_name.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-medium">{user?.full_name}</span>
                <span className="block text-2xs text-muted-foreground">{user?.role_display}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground">{user?.username}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* En el teléfono no caben nueve controles en la franja de arriba,
                así que tema e idioma viven aquí, con la misma altura de dedo.
                El tema se lee de la pantalla y no de la preferencia: con una
                sucursal configurada en oscuro, `theme` vale `business` y el
                primer toque volvía a poner oscuro -- un toque sin efecto. */}
            <DropdownMenuItem
              className="h-11 sm:hidden"
              onSelect={() => setTheme(modoEnPantalla === 'dark' ? 'light' : 'dark')}
            >
              {modoEnPantalla === 'dark' ? <PiSun /> : <PiMoon />}
              {modoEnPantalla === 'dark' ? t('tema.claro') : t('tema.oscuro')}
            </DropdownMenuItem>
            {IDIOMAS.map((codigo) => (
              <DropdownMenuItem
                key={codigo}
                className="h-11 sm:hidden"
                onSelect={() => cambiarIdioma(codigo)}
              >
                <PiTranslate />
                {t(`idioma.${codigo}`)}
                {idiomaActual() === codigo ? (
                  <PiCheck className="ml-auto h-3.5 w-3.5" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
            {operational ? (
              <DropdownMenuItem className="sm:hidden" onSelect={() => setSoundAlerts(!soundAlerts)}>
                {soundAlerts ? <PiSpeakerSlash /> : <PiSpeakerHigh />}
                {soundAlerts ? 'Silenciar alertas' : 'Activar alertas'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <PiKey />
              Cambiar contraseña
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate()}>
              <PiSignOut />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {operational ? (
        <StayDetailDialog
          stayId={stayId}
          open={stayId !== null}
          onOpenChange={(open) => !open && setStayId(null)}
        />
      ) : null}

      <ChangePasswordDialog
        open={passwordOpen}
        required={Boolean(user?.must_change_password)}
        onOpenChange={setPasswordOpen}
      />
    </header>
  )
}
