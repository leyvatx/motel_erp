import { useEffect, useState } from 'react'
import { LuLoaderCircle } from 'react-icons/lu'

import { cn } from '@/lib/utils'

/** Lo que se cuenta mientras el servidor arranca.
 *
 *  Tres frases, no una barra de progreso: no hay forma de saber cuánto falta, y
 *  un porcentaje inventado es peor que no poner ninguno -- cuando se atora en
 *  87 % la gente deja de creerle a todo lo demás.
 *
 *  Lo que sí se puede decir con verdad es *qué* se está haciendo, y eso cambia
 *  con el tiempo transcurrido. Ninguna menciona contenedores, arranques en frío
 *  ni servicios que duermen: quien se está registrando no tiene por qué saber en
 *  qué está alojado esto.
 */
const FASES = [
  { desde: 0, texto: 'Preparando tu espacio…' },
  { desde: 6000, texto: 'Levantando el sistema. Tarda un poco la primera vez.' },
  { desde: 20000, texto: 'Casi listo. Gracias por esperar.' },
] as const

interface Props {
  /** Cuándo empezó la espera, para elegir qué frase toca. */
  desde: number
  onCancelar: () => void
}

/**
 * La espera del alta, contada en lugar de escondida.
 *
 * Aparece entre que se pulsa "Crear cuenta" y que el servidor contesta. Antes
 * ese hueco era un botón girando: si el servicio estaba dormido podían pasar
 * cuarenta segundos sin una palabra, y el usuario lo leía como que algo se
 * rompió -- así que recargaba o volvía a pulsar.
 *
 * Cancelar solo se ofrece porque en este punto todavía no se ha mandado nada:
 * se está tocando la puerta. Una vez enviada el alta desaparece, porque cancelar
 * ahí dejaría al usuario sin saber si su negocio se creó o no.
 */
export function PreparandoEspacio({ desde, onCancelar }: Props) {
  const [transcurrido, setTranscurrido] = useState(() => Date.now() - desde)

  useEffect(() => {
    const id = window.setInterval(() => setTranscurrido(Date.now() - desde), 1000)
    return () => window.clearInterval(id)
  }, [desde])

  const fase = [...FASES].reverse().find((f) => transcurrido >= f.desde) ?? FASES[0]

  return (
    <div className="rounded-lg border bg-card p-6 text-center" role="status" aria-live="polite">
      <LuLoaderCircle
        className="mx-auto h-7 w-7 animate-spin text-brand-accent motion-reduce:animate-none"
        aria-hidden
      />

      <p className="mt-4 text-sm font-medium">{fase.texto}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        No cierres esta ventana. En cuanto esté, entras directo a configurar tu negocio.
      </p>

      {/* Tres puntos que se van llenando con el tiempo. No es progreso -- no se
          sabe cuánto falta -- pero sí demuestra que algo sigue ocurriendo, que
          es lo que un spinner solo no alcanza a decir. */}
      <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
        {FASES.map((f) => (
          <span
            key={f.desde}
            className={cn(
              'h-1.5 w-1.5 rounded-full transition-colors duration-500',
              transcurrido >= f.desde ? 'bg-brand-accent' : 'bg-muted-foreground/25',
            )}
          />
        ))}
      </div>

      {transcurrido > 12000 ? (
        <button
          type="button"
          onClick={onCancelar}
          className="mt-5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Cancelar y volver al formulario
        </button>
      ) : null}
    </div>
  )
}
