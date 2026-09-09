import { Fragment, useMemo } from 'react'
import { PiCheck, PiLockKey, PiMinus } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRoleMatrix } from '@/features/users/hooks'
import type { PermissionOption, RoleMatrixRole } from '@/features/users/types'
import { cn } from '@/lib/utils'

/** El check y la raya llevan texto para lector de pantalla: el color y la forma
 *  son refuerzo, no el dato. Una matriz de permisos leída al revés por alguien
 *  que no distingue verde de gris es peor que no tenerla. */
function Celda({ concedido, rol, permiso }: { concedido: boolean; rol: string; permiso: string }) {
  const { t } = useTranslation()
  return (
    <td className="border-b px-3 py-2 text-center align-middle">
      <span
        className={cn(
          'mx-auto flex h-6 w-6 items-center justify-center rounded-full',
          concedido ? 'bg-status-available/15 text-status-available' : 'text-muted-foreground/40',
        )}
      >
        {concedido ? (
          <PiCheck className="h-3.5 w-3.5 stroke-[16]" aria-hidden />
        ) : (
          <PiMinus className="h-3.5 w-3.5" aria-hidden />
        )}
        <span className="sr-only">
          {rol} {concedido ? t('usuarios.siPuede') : 'no puede'}: {permiso}
        </span>
      </span>
    </td>
  )
}

function Cargando() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-[28rem] w-full rounded-xl" />
    </div>
  )
}

export function PermissionMatrix() {
  const { t } = useTranslation()
  const { data, isPending } = useRoleMatrix()

  const grupos = useMemo(() => {
    const porGrupo = new Map<string, PermissionOption[]>()
    for (const permiso of data?.permissions ?? []) {
      const previos = porGrupo.get(permiso.group)
      if (previos) previos.push(permiso)
      else porGrupo.set(permiso.group, [permiso])
    }
    return [...porGrupo.entries()]
  }, [data])

  if (isPending) return <Cargando />

  const roles: RoleMatrixRole[] = data?.roles ?? []
  const total = data?.permissions.length ?? 0
  const concede = (rol: RoleMatrixRole, code: string): boolean => rol.permissions.includes(code)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-4">
      <Alert variant="muted">
        <PiLockKey aria-hidden />
        <div className="space-y-1">
          <AlertTitle>{t('usuarios.permisosNoSeEditan')}</AlertTitle>
          <AlertDescription>{t('usuarios.matrizFijada')}</AlertDescription>
        </div>
      </Alert>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium">{t('usuarios.quePuedeHacerCadaRol')}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {roles.map((rol) => (
              <p key={rol.value} className="text-xs text-muted-foreground">
                {rol.label}{' '}
                <span className="font-medium tabular text-foreground">
                  {rol.permissions.length}/{total}
                </span>
              </p>
            ))}
          </div>
        </div>

        {/* El contenedor del scroll y el de la tabla son el mismo a propósito:
            con un div de por medio, `sticky` se ancla al de adentro y los
            encabezados dejan de pegarse al bajar. */}
        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          <table className="w-full caption-bottom border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-30 border-b bg-card px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                >
                  Permiso
                </th>
                {roles.map((rol) => (
                  <th
                    key={rol.value}
                    scope="col"
                    className="sticky top-0 z-20 w-28 border-b bg-card px-3 py-2.5 text-center text-xs font-medium text-foreground"
                  >
                    {rol.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {grupos.map(([grupo, permisos]) => (
                <Fragment key={grupo}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={roles.length + 1}
                      className="sticky left-0 z-10 border-b border-t bg-muted/60 px-4 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {grupo}
                    </th>
                  </tr>

                  {permisos.map((permiso) => (
                    <tr key={permiso.code} className="transition-colors hover:bg-muted/40">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b bg-card px-4 py-2 text-left font-normal"
                      >
                        <span className="block text-xs font-medium text-foreground">
                          {permiso.label}
                        </span>
                        <span className="block font-mono text-2xs text-muted-foreground">
                          {permiso.code}
                        </span>
                      </th>
                      {roles.map((rol) => (
                        <Celda
                          key={rol.value}
                          concedido={concede(rol, permiso.code)}
                          rol={rol.label}
                          permiso={permiso.label}
                        />
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
