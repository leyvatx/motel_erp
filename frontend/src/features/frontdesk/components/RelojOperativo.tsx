import { useEffect, useState } from 'react'
import { LuClock } from 'react-icons/lu'

import { serverNow } from '@/lib/serverTime'

/** La hora del servidor, no la del equipo del mostrador.
 *
 *  Los cronómetros de las tarjetas se calculan contra el reloj del servidor
 *  -- una terminal con la hora atrasada mostraría rentas vencidas que no lo
 *  están -- y este reloj tiene que salir de la misma fuente. Si no, recepción
 *  ve una hora arriba y otra en las tarjetas, y la que se cuestiona es la
 *  correcta.
 */
export function RelojOperativo() {
  const [ahora, setAhora] = useState(() => serverNow())

  useEffect(() => {
    const id = window.setInterval(() => setAhora(serverNow()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const fecha = new Date(ahora)
  const hora = fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <span
      className="hidden h-9 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 md:inline-flex"
      title="Hora de operación"
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
