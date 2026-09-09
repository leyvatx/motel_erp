import { LuClock } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'

import { useServerClock } from '@/hooks/useCountdown'

/** La hora del servidor, no la del equipo del mostrador.
 *
 *  Los cronómetros de las tarjetas se calculan contra el reloj del servidor
 *  -- una terminal con la hora atrasada mostraría rentas vencidas que no lo
 *  están -- y este reloj tiene que salir de la misma fuente. Si no, recepción
 *  ve una hora arriba y otra en las tarjetas, y la que se cuestiona es la
 *  correcta.
 *
 *  Late con el mismo temporizador compartido que las tarjetas, así que marcan
 *  el mismo segundo sin costar un `setInterval` extra.
 */
export function RelojOperativo() {
  const { t } = useTranslation()
  const fecha = new Date(useServerClock())
  const hora = fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <span
      className="hidden h-9 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 md:inline-flex"
      title={t('recepcion.horaDeOperacion')}
    >
      <LuClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <time
        dateTime={fecha.toISOString()}
        className="font-mono text-sm leading-none tabular tracking-tight"
      >
        {hora}
      </time>
    </span>
  )
}
