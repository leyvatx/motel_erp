import { Suspense, lazy, type ComponentProps, type ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import type { PaymentMix as PaymentMixTipo } from '@/features/dashboard/charts/PaymentMix'
import type { RoomDonut as RoomDonutTipo } from '@/features/dashboard/charts/RoomDonut'
import type { ShiftTrendChart as ShiftTrendChartTipo } from '@/features/dashboard/charts/ShiftTrendChart'
import type { Sparkline as SparklineTipo } from '@/features/dashboard/charts/Sparkline'

/**
 * Las gráficas, fuera del camino crítico del tablero.
 *
 * Recharts pesa más que todo lo demás del panel junto, y el panel es la
 * pantalla a la que cae *todo el mundo* después de entrar. Importándolo de
 * forma directa, los números -- ocupación, turno, pendientes, que es a lo que
 * se entra -- esperaban a que bajara una librería de dibujo que solo pinta dos
 * tarjetas.
 *
 * Con `lazy` la librería se va a su propio trozo: la cuadrícula aparece
 * completa y las gráficas se rellenan un instante después, cada una sobre su
 * propio esqueleto. Las cuatro comparten trozo, así que es una sola descarga.
 */
const RoomDonutLazy = lazy(() =>
  import('@/features/dashboard/charts/RoomDonut').then((m) => ({ default: m.RoomDonut })),
)
const ShiftTrendChartLazy = lazy(() =>
  import('@/features/dashboard/charts/ShiftTrendChart').then((m) => ({
    default: m.ShiftTrendChart,
  })),
)
const PaymentMixLazy = lazy(() =>
  import('@/features/dashboard/charts/PaymentMix').then((m) => ({ default: m.PaymentMix })),
)
const SparklineLazy = lazy(() =>
  import('@/features/dashboard/charts/Sparkline').then((m) => ({ default: m.Sparkline })),
)

function Espera({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

export function RoomDonut(props: ComponentProps<typeof RoomDonutTipo>) {
  return (
    <Espera fallback={<Skeleton className="h-full min-h-40 w-full rounded-lg" />}>
      <RoomDonutLazy {...props} />
    </Espera>
  )
}

export function ShiftTrendChart(props: ComponentProps<typeof ShiftTrendChartTipo>) {
  return (
    <Espera fallback={<Skeleton className="h-full min-h-40 w-full rounded-lg" />}>
      <ShiftTrendChartLazy {...props} />
    </Espera>
  )
}

export function PaymentMix(props: ComponentProps<typeof PaymentMixTipo>) {
  return (
    <Espera fallback={<Skeleton className="h-20 w-full rounded-lg lg:w-56" />}>
      <PaymentMixLazy {...props} />
    </Espera>
  )
}

/** Sin esqueleto: vive dentro de una ficha de indicador y ya sabe desaparecer
 *  cuando no hay historia que dibujar. Un hueco parpadeando junto al número
 *  sería más ruido que la línea que sustituye. */
export function Sparkline(props: ComponentProps<typeof SparklineTipo>) {
  return (
    <Espera fallback={null}>
      <SparklineLazy {...props} />
    </Espera>
  )
}
