import { useEffect, useState } from 'react'
import { KeyRound, LogOut, Menu, Moon, Sun, Volume2, VolumeX } from 'lucide-react'
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
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { TeamPresence } from '@/features/users/TeamPresence'
import { StayDetailDialog } from '@/features/frontdesk/components/StayDetailDialog'
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog'
import { useLogout } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'
import { useAppearanceStore } from '@/store/appearance'
import { useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'
import type { ConnectionState } from '@/types/realtime'

interface Props {
  connection: ConnectionState
}

export function Topbar({ connection }: Props) {
  const user = useAuthStore((state) => state.user)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const soundAlerts = useUiStore((state) => state.soundAlerts)
  const setSoundAlerts = useUiStore((state) => state.setSoundAlerts)
  const theme = useAppearanceStore((state) => state.theme)
  const setTheme = useAppearanceStore((state) => state.setTheme)
  const logout = useLogout()

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
    <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 lg:px-5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={toggleSidebar}
        aria-label="Abrir menú"
      >
        <Menu />
      </Button>

      <div className="hidden lg:block">
        <Breadcrumbs />
      </div>

      <Separator orientation="vertical" className="mx-1 hidden h-5 lg:block" />

      {operational ? <GlobalSearch onSelectStay={setStayId} /> : null}

      {corporate && activeMotelName ? (
        <Button variant="outline" size="sm" className="hidden max-w-52 sm:flex" onClick={() => {
          clearActiveMotel()
          queryClient.clear()
          navigate('/corporate')
        }}>
          {activeMotelName} · Volver
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-0.5">
        {operational ? (
          <>
            <span
              className="mr-1.5 hidden items-center gap-1.5 rounded-full border px-2 py-1 text-2xs font-medium text-muted-foreground sm:flex"
              title={online ? 'Conectado en tiempo real' : 'Reconectando al servidor'}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  online ? 'bg-status-available' : 'animate-pulse-alert bg-status-cleaning',
                )}
                aria-hidden
              />
              {online ? 'En línea' : 'Reconectando'}
            </span>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSoundAlerts(!soundAlerts)}
              aria-label={soundAlerts ? 'Silenciar alertas' : 'Activar alertas sonoras'}
              title={soundAlerts ? 'Alertas sonoras activas' : 'Alertas sonoras silenciadas'}
            >
              {soundAlerts ? <Volume2 /> : <VolumeX className="text-muted-foreground" />}
            </Button>
          </>
        ) : null}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        {operational ? (
          <>
            <NotificationBell />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <TeamPresence />
            <Separator orientation="vertical" className="mx-1 h-5" />
          </>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-1.5">
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
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound />
              Cambiar contraseña
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate()}>
              <LogOut />
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
