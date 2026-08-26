import { Line, LineChart, ResponsiveContainer } from 'recharts'

interface Props {
  /** Un punto por hora, en orden. Menos de dos puntos no es una tendencia. */
  values: number[]
  className?: string
}

/**
 * Mini línea sin ejes ni tooltip, para poner junto a un número grande.
 *
 * Solo se usa donde hay historia de verdad. Las otras tarjetas del panel
 * (Disponibles, Por vencer, Limpieza) son fotos del momento: nada guarda cómo
 * estaban hace una hora, y dibujarles una línea inventada convierte el panel en
 * algo sobre lo que alguien va a decidir creyendo que mide algo.
 */
export function Sparkline({ values, className }: Props) {
  const primero = values.at(0)
  const ultimo = values.at(-1)
  if (values.length < 2 || primero === undefined || ultimo === undefined) return null

  const data = values.map((valor, indice) => ({ i: indice, valor }))
  const sube = ultimo >= primero

  return (
    <div className={className} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line
            type="monotone"
            dataKey="valor"
            stroke={`hsl(var(${sube ? '--status-available' : '--muted-foreground'}))`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
