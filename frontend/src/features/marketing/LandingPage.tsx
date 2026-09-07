import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LuArrowRight,
  LuBed,
  LuClock,
  LuDoorOpen,
  LuLayoutGrid,
  LuLock,
  LuNetwork,
  LuReceipt,
  LuScrollText,
  LuSparkles,
  LuUser,
  LuVault,
} from 'react-icons/lu'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { APP_FALLBACK_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

/* =========================================================================
 * Tokens tomados de la guía UI/UX Pro Max
 * (github.com/nextlevelbuilder/ui-ux-pro-max-skill, src/ui-ux-pro-max/data)
 *
 * styles.csv > dimensional-layering — Design System Variables:
 *   --elevation-1: 0 1px 3px rgba(0,0,0,0.1)
 *   --elevation-2: 0 4px 6px rgba(0,0,0,0.1)
 *   --elevation-3: 0 10px 20px rgba(0,0,0,0.1)
 *   --elevation-4: 0 20px 40px rgba(0,0,0,0.15)
 *   backdrop-filter: blur(8px)
 *
 * styles.csv > bento-box-grid — Design System Variables:
 *   --card-radius: 24px, --grid-gap: 16px, --hover-scale: 1.02
 *   Checklist: rejilla 4→2→1, spans variados, sombras sutiles
 *
 * styles.csv > swiss-modernism-2-0:
 *   unidad base 8px, un solo acento, sin degradados, alto contraste
 *
 * typography.csv #61 — escala:
 *   Hero 36-42pt / interlínea 1.1 · H2 28-32pt · Cuerpo 16-18pt
 *   Etiqueta 12pt mono en versalitas con tracking 1.5
 *
 * motion.csv > Hover Micro-interaction (Standard): 200-300ms, y:-4, escala 1.02
 *
 * ux-guidelines.csv aplicadas:
 *   Touch > Gesture Conflicts: el desplazamiento vertical manda; nada de
 *     carrusel que solo responda a deslizar en horizontal.
 *   Accessibility > Keyboard Navigation (alta): los pasos se operan con
 *     teclado; de ahí que las pestañas usen el primitivo de Radix.
 *   Accessibility > Motion Sensitivity (alta): con movimiento reducido se
 *     pinta el estado final, sin transiciones.
 *   Accessibility > Skip Links: liga para saltar la navegación.
 * ========================================================================= */

/** Elevaciones de `dimensional-layering`. En oscuro una sombra negra no se ve,
 *  así que la profundidad la da un aro de luz interior: es el equivalente
 *  sobrio del "glow", sin el resplandor de plantilla. */
const ELEV = {
  reposo: 'shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-none',
  media: 'shadow-[0_4px_6px_rgba(0,0,0,0.1)] dark:shadow-none',
  alta: 'shadow-[0_10px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)]',
} as const

/** Micro-borde con profundidad: el borde marca el límite y el aro interior le
 *  da el canto. Un `border` de 1 px a secas se lee plano en pantallas densas. */
const CANTO =
  'border border-zinc-200/80 ring-1 ring-inset ring-white/60 dark:border-zinc-800/80 dark:ring-white/[0.04]'

/** Radio de tarjeta de `bento-box-grid`. */
const RADIO = 'rounded-[24px]'

/** Etiqueta de sección: 12px, mono, versalitas, tracking 1.5 (typography #61). */
const ETIQUETA_SECCION =
  'font-mono text-[0.75rem] uppercase leading-none tracking-[0.15em] text-zinc-500 dark:text-zinc-400'

const SUAVE = 'text-zinc-500 dark:text-zinc-400'
const BORDE = 'border-zinc-200/80 dark:border-zinc-800/80'

/* ------------------------------------------------------- datos de la maqueta */

type Estado = 'apagada' | 'libre' | 'ocupada' | 'limpieza'

interface Habitacion {
  numero: string
  tipo: string
  huespedes: number
  avance: number
  salida: string
  linea: [Estado, Estado, Estado, Estado]
}

const HABITACIONES: Habitacion[] = [
  {
    numero: '101',
    tipo: 'Sencilla',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '102',
    tipo: 'Doble',
    huespedes: 2,
    avance: 92,
    salida: '14:30',
    linea: ['libre', 'ocupada', 'ocupada', 'limpieza'],
  },
  {
    numero: '103',
    tipo: 'Sencilla',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '104',
    tipo: 'Jacuzzi',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '201',
    tipo: 'Doble',
    huespedes: 2,
    avance: 41,
    salida: '17:00',
    linea: ['libre', 'ocupada', 'ocupada', 'ocupada'],
  },
  {
    numero: '202',
    tipo: 'Sencilla',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '203',
    tipo: 'Jacuzzi',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '204',
    tipo: 'Doble',
    huespedes: 1,
    avance: 67,
    salida: '19:15',
    linea: ['libre', 'ocupada', 'ocupada', 'ocupada'],
  },
]

const APAGADO = -1
const MAX_AVATARES = 4

function estadoEn(habitacion: Habitacion, paso: number): Estado {
  if (paso < 0) return 'apagada'
  return habitacion.linea[Math.min(paso, 3)] ?? 'libre'
}

const PASOS = [
  {
    corto: 'Alta',
    titulo: 'Configuración relámpago',
    resumen: 'Tipos, tarifas y lote de habitaciones en un asistente de cuatro pasos.',
    detalle:
      'Se declara una vez cuánto dura y cuánto cuesta cada estancia. El tablero queda armado antes de que llegue el primer huésped, sin capturar cuarto por cuarto.',
    icono: LuLayoutGrid,
  },
  {
    corto: 'Ocupación',
    titulo: 'Ocupación y tiempos en vivo',
    resumen: 'Quién entró, cuántos son y cuánto les queda, sin abrir nada.',
    detalle:
      'Cada tarjeta lleva su cronómetro y su barra de avance. Recepción ve de un vistazo cuál está por vencerse en lugar de revisar una lista de horas de salida.',
    icono: LuClock,
  },
  {
    corto: 'Consumo',
    titulo: 'Comandas y folios de consumo',
    resumen: 'Lo que se consume se carga a la cuenta del cuarto y descuenta inventario.',
    detalle:
      'El folio vive junto a la estancia. Cargar una comanda mueve el Kardex en el mismo movimiento, así que el corte de caja cuadra con el almacén sin conciliar a mano.',
    icono: LuReceipt,
  },
  {
    corto: 'Rotación',
    titulo: 'Rotación y control de limpieza',
    resumen: 'Al cobrar, el cuarto entra solo al tablero de ama de llaves.',
    detalle:
      'La salida dispara la tarea, la tarea libera el cuarto y las métricas de arriba se mueven en el momento. Nadie tiene que avisarle a nadie para que la rotación siga.',
    icono: LuSparkles,
  },
] as const

const TARJETA: Record<Estado, string> = {
  apagada: 'border-zinc-200/80 bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/40',
  libre: 'border-emerald-500/30 bg-emerald-500/10',
  ocupada: 'border-indigo-500/30 bg-indigo-500/10',
  limpieza: 'border-amber-500/35 bg-amber-500/10',
}

const PUNTO: Record<Estado, string> = {
  apagada: 'bg-zinc-300 dark:bg-zinc-700',
  libre: 'bg-emerald-500',
  ocupada: 'bg-indigo-500',
  limpieza: 'bg-amber-500',
}

const ETIQUETA_ESTADO: Record<Estado, string> = {
  apagada: 'text-zinc-400 dark:text-zinc-600',
  libre: 'text-emerald-700 dark:text-emerald-400',
  ocupada: 'text-indigo-700 dark:text-indigo-400',
  limpieza: 'text-amber-700 dark:text-amber-500',
}

const NOMBRE: Record<Estado, string> = {
  apagada: '—',
  libre: 'Libre',
  ocupada: 'Ocupada',
  limpieza: 'Limpieza',
}

/* --------------------------------------------------------------- la maqueta */

function Metrica({
  etiqueta,
  valor,
  porcentaje,
  punto,
  encendido,
}: {
  etiqueta: string
  valor: number
  porcentaje: number | null
  punto?: string
  encendido: boolean
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        {punto ? (
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-500 motion-reduce:transition-none',
              encendido ? punto : 'bg-zinc-300 dark:bg-zinc-700',
            )}
            aria-hidden
          />
        ) : null}
        <span className={cn('truncate', ETIQUETA_SECCION, 'text-[0.625rem]')}>{etiqueta}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold leading-none tabular tracking-tight text-zinc-900 dark:text-zinc-100">
          {valor}
        </span>
        {porcentaje !== null ? (
          <span className={cn('font-mono text-[0.625rem] leading-none tabular', SUAVE)}>
            {porcentaje}%
          </span>
        ) : null}
      </div>
    </div>
  )
}

function TarjetaHabitacion({ habitacion, paso }: { habitacion: Habitacion; paso: number }) {
  const estado = estadoEn(habitacion, paso)
  const ocupada = estado === 'ocupada'
  const visibles = Math.min(habitacion.huespedes, MAX_AVATARES)

  return (
    <div
      className={cn(
        'relative flex min-h-[5.5rem] flex-col overflow-hidden rounded-xl border p-2.5',
        'transition-colors duration-500 motion-reduce:transition-none',
        TARJETA[estado],
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="font-mono text-base font-medium leading-none tabular tracking-tight text-zinc-900 dark:text-zinc-100">
            {habitacion.numero}
          </p>
          <p className={cn('mt-1 truncate text-[0.625rem] leading-none', SUAVE)}>
            {habitacion.tipo}
          </p>
        </div>

        <span
          className={cn(
            'flex -space-x-1 transition-opacity duration-500 motion-reduce:transition-none',
            ocupada ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden
        >
          {Array.from({ length: ocupada ? visibles : 0 }, (_, indice) => (
            <span
              key={indice}
              className="flex h-4 w-4 items-center justify-center rounded-full border border-white bg-indigo-500/20 dark:border-zinc-900"
            >
              <LuUser className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400" />
            </span>
          ))}
        </span>
      </div>

      <div className="mt-auto pt-2">
        <div className="flex items-center justify-between gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[0.08em]',
              'transition-colors duration-500 motion-reduce:transition-none',
              ETIQUETA_ESTADO[estado],
            )}
          >
            <span
              className={cn(
                'h-1 w-1 rounded-full transition-colors duration-500 motion-reduce:transition-none',
                PUNTO[estado],
              )}
              aria-hidden
            />
            {NOMBRE[estado]}
          </span>

          <span
            className={cn(
              'font-mono text-[0.625rem] leading-none tabular transition-opacity duration-500 motion-reduce:transition-none',
              SUAVE,
              ocupada ? 'opacity-100' : 'opacity-0',
            )}
          >
            {habitacion.salida}
          </span>
        </div>

        <div
          className={cn(
            'mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-900/10 dark:bg-zinc-100/10',
            'transition-opacity duration-500 motion-reduce:transition-none',
            ocupada ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div
            className="h-full rounded-full bg-indigo-500/70 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${ocupada ? habitacion.avance : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function PanelFolio({ visible }: { visible: boolean }) {
  const cargos = [
    { concepto: 'Cerveza 355 ml', cantidad: 2, importe: '90.00' },
    { concepto: 'Botana mixta', cantidad: 1, importe: '65.00' },
    { concepto: 'Estancia 4 h', cantidad: 1, importe: '350.00' },
  ]

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute inset-y-3 right-3 w-[13.5rem] rounded-2xl p-3',
        'bg-white/95 backdrop-blur-[8px] dark:bg-zinc-950/95',
        CANTO,
        ELEV.alta,
        'transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
        visible ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0',
      )}
    >
      <div className={cn('flex items-baseline justify-between border-b pb-2', BORDE)}>
        <span className="text-xs font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
          Folio · Hab. 201
        </span>
        <span className={cn('font-mono text-[0.625rem] tabular', SUAVE)}>F-00218</span>
      </div>

      <ul className="mt-2 space-y-1.5">
        {cargos.map((cargo) => (
          <li key={cargo.concepto} className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[0.6875rem] text-zinc-700 dark:text-zinc-300">
              <span className={cn('font-mono tabular', SUAVE)}>{cargo.cantidad}×</span>{' '}
              {cargo.concepto}
            </span>
            <span className="shrink-0 font-mono text-[0.6875rem] tabular text-zinc-900 dark:text-zinc-100">
              {cargo.importe}
            </span>
          </li>
        ))}
      </ul>

      <div className={cn('mt-2 flex items-baseline justify-between border-t pt-2', BORDE)}>
        <span className="text-[0.6875rem] font-medium text-zinc-900 dark:text-zinc-100">Total</span>
        <span className="font-mono text-sm font-semibold tabular tracking-tight text-zinc-900 dark:text-zinc-100">
          505.00
        </span>
      </div>

      <div className="mt-2.5 flex h-7 items-center justify-center rounded-lg bg-zinc-900 text-[0.6875rem] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
        Cobrar y cerrar
      </div>
    </div>
  )
}

function Tablero({ paso }: { paso: number }) {
  const encendido = paso >= 0
  const estados = HABITACIONES.map((habitacion) => estadoEn(habitacion, paso))
  const total = HABITACIONES.length
  const contar = (estado: Estado): number => estados.filter((valor) => valor === estado).length
  const porcentaje = (valor: number): number | null =>
    encendido ? Math.round((valor / total) * 100) : null

  return (
    <div
      className={cn('relative overflow-hidden bg-white dark:bg-zinc-950', RADIO, CANTO, ELEV.alta)}
    >
      <div className={cn('flex items-center gap-2 border-b px-4 py-2.5', BORDE)}>
        <span className="flex gap-1" aria-hidden>
          {[
            'bg-zinc-300 dark:bg-zinc-700',
            'bg-zinc-200 dark:bg-zinc-800',
            'bg-zinc-200 dark:bg-zinc-800',
          ].map((tono, indice) => (
            <span key={indice} className={cn('h-2 w-2 rounded-full', tono)} />
          ))}
        </span>
        <span className={cn(ETIQUETA_SECCION, 'text-[0.625rem]')}>
          Control operativo · Turno vespertino
        </span>
      </div>

      <div className={cn('flex items-start gap-3 border-b px-4 py-3', BORDE)}>
        <Metrica etiqueta="Total" valor={total} porcentaje={null} encendido={encendido} />
        <Metrica
          etiqueta="Ocupadas"
          valor={contar('ocupada')}
          porcentaje={porcentaje(contar('ocupada'))}
          punto="bg-indigo-500"
          encendido={encendido}
        />
        <Metrica
          etiqueta="Libres"
          valor={contar('libre')}
          porcentaje={porcentaje(contar('libre'))}
          punto="bg-emerald-500"
          encendido={encendido}
        />
        <Metrica
          etiqueta="Por limpiar"
          valor={contar('limpieza')}
          porcentaje={porcentaje(contar('limpieza'))}
          punto="bg-amber-500"
          encendido={encendido}
        />
      </div>

      <div className="relative p-3">
        <div className="grid grid-cols-4 gap-2">
          {HABITACIONES.map((habitacion) => (
            <TarjetaHabitacion key={habitacion.numero} habitacion={habitacion} paso={paso} />
          ))}
        </div>

        <PanelFolio visible={paso === 2} />
      </div>
    </div>
  )
}

/* --------------------------------------------------------- pasos explicados */

function TextoPaso({ indice, activo }: { indice: number; activo: boolean }) {
  const item = PASOS[indice]
  if (!item) return null
  const Icono = item.icono

  return (
    <div
      className={cn(
        'border-l-2 pl-5 transition-colors duration-500 motion-reduce:transition-none',
        activo ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-800',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'font-mono text-[0.75rem] tabular tracking-[0.15em] transition-colors duration-500 motion-reduce:transition-none',
            activo ? 'text-zinc-900 dark:text-zinc-100' : SUAVE,
          )}
        >
          0{indice + 1}
        </span>
        <Icono
          className={cn(
            'h-4 w-4 transition-colors duration-500 motion-reduce:transition-none',
            activo ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-600',
          )}
          aria-hidden
        />
      </div>

      {/* H3 dentro de la escala: bajo el H2 de sección (28-32) y sobre el
          cuerpo (16-18). */}
      <h3
        className={cn(
          'mt-3 text-[1.375rem] font-semibold leading-[1.15] tracking-[-0.015em] transition-colors duration-500 motion-reduce:transition-none sm:text-[1.5rem]',
          activo ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-600',
        )}
      >
        {item.titulo}
      </h3>

      <p
        className={cn(
          'mt-2 text-pretty text-[1.0625rem] font-medium leading-[1.5] transition-colors duration-500 motion-reduce:transition-none',
          activo ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-600',
        )}
      >
        {item.resumen}
      </p>

      <p
        className={cn(
          'mt-3 text-pretty text-[0.9375rem] leading-[1.6] transition-colors duration-500 motion-reduce:transition-none',
          activo ? SUAVE : 'text-zinc-300 dark:text-zinc-700',
        )}
      >
        {item.detalle}
      </p>
    </div>
  )
}

/** Escaparate táctil, para menos de `lg`.
 *
 *  El recorrido por desplazamiento con panel pegajoso no funciona en un
 *  teléfono: la maqueta se va de cuadro mientras se lee el texto y nadie llega
 *  a ver encenderse la habitación de la que le están hablando. Aquí la maqueta
 *  queda arriba, el selector debajo y el texto al pie: las tres cosas caben a
 *  la vez y ninguna se desfasa de la otra.
 *
 *  Son pestañas y no un carrusel a propósito. La guía marca que el
 *  desplazamiento vertical manda y desaconseja el carrusel que solo responde a
 *  deslizar en horizontal; las pestañas de Radix además ya traen navegación con
 *  flechas, `aria-selected` y foco visible. */
function EscaparateTactil({ paso, onPaso }: { paso: number; onPaso: (paso: number) => void }) {
  const actual = Math.max(paso, 0)

  return (
    <Tabs
      value={String(actual)}
      onValueChange={(valor) => onPaso(Number(valor))}
      className="space-y-4"
    >
      <Tablero paso={actual} />

      <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {PASOS.map((item, indice) => (
          <TabsTrigger
            key={item.titulo}
            value={String(indice)}
            className={cn(
              'h-11 flex-col gap-0.5 rounded-lg px-1',
              'data-[state=active]:bg-white data-[state=active]:text-zinc-900',
              'dark:data-[state=active]:bg-zinc-950 dark:data-[state=active]:text-zinc-100',
            )}
          >
            <span className="font-mono text-[0.625rem] leading-none tabular tracking-[0.1em]">
              0{indice + 1}
            </span>
            <span className="text-[0.6875rem] leading-none">{item.corto}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {PASOS.map((item, indice) => (
        <TabsContent key={item.titulo} value={String(indice)} className="mt-4">
          <TextoPaso indice={indice} activo />
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** Escaparate de escritorio: panel pegajoso y pasos que pasan por el centro.
 *
 *  Aquí sí cabe todo a la vez, así que el desplazamiento natural es el mejor
 *  control: no hay que pedirle al visitante que haga clic para avanzar. */
function EscaparateDeEscritorio({
  paso,
  onPaso,
}: {
  paso: number
  onPaso: (paso: number) => void
}) {
  const pasosRef = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    // La franja del 45 % arriba y abajo deja viva una banda del 10 % al centro
    // de la pantalla, y el paso que la cruza es el que manda.
    //
    // En el límite entre dos pasos la cruzan los dos a la vez -- son contiguos
    // y la banda mide menos que cualquiera de ellos -- así que hace falta una
    // regla, no quedarse con el primero que reporte el navegador: ahí es donde
    // aparecerían los parpadeos. Gana el que va primero en el documento, que da
    // la histéresis correcta en las dos direcciones.
    const cruzando = new Set<Element>()

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) cruzando.add(entrada.target)
          else cruzando.delete(entrada.target)
        })

        const indices = pasosRef.current
          .map((nodo, indice) => (nodo && cruzando.has(nodo) ? indice : -1))
          .filter((indice) => indice >= 0)

        // Sin nada en la banda -- el hero, o ya pasada la sección -- se conserva
        // el último paso: apagar la maqueta al salir sería un parpadeo más.
        if (indices.length > 0) onPaso(indices[0] as number)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )

    const nodos = pasosRef.current.filter((nodo): nodo is HTMLElement => nodo !== null)
    nodos.forEach((nodo) => observador.observe(nodo))
    return () => observador.disconnect()
  }, [onPaso])

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="order-last">
        <div className="sticky top-24">
          <Tablero paso={paso} />
          <ol className="mt-4 flex gap-1.5" aria-hidden>
            {PASOS.map((item, indice) => (
              <li
                key={item.titulo}
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none',
                  indice <= paso ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-800',
                )}
              />
            ))}
          </ol>
        </div>
      </div>

      <div className="pb-[30vh] pt-[10vh]">
        {PASOS.map((item, indice) => (
          <section
            key={item.titulo}
            ref={(nodo) => {
              pasosRef.current[indice] = nodo
            }}
            className="flex min-h-[70vh] flex-col justify-center py-10"
          >
            <TextoPaso indice={indice} activo={paso === indice} />
          </section>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------ bento de confianza */

const BENTO = [
  {
    id: 'aislamiento',
    titulo: 'Aislamiento por sucursal',
    icono: LuNetwork,
    texto:
      'El filtro por sucursal vive en la capa de datos, no en cada pantalla: una consulta que lo olvide no devuelve de más, devuelve vacío.',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    id: 'roles',
    titulo: 'Roles jerárquicos',
    icono: LuLock,
    texto:
      'Cada acción sensible declara qué permiso exige. Recepción cobra pero no ve costos ni márgenes; ama de llaves opera su tablero y nada más.',
    span: 'md:col-span-2',
  },
  {
    id: 'caja',
    titulo: 'Cortes de caja ciegos',
    icono: LuVault,
    texto: 'Quien cierra el turno captura el efectivo sin ver lo que el sistema esperaba.',
    span: 'md:col-span-1',
  },
  {
    id: 'bitacora',
    titulo: 'Bitácora inmutable',
    icono: LuScrollText,
    texto: 'Un movimiento equivocado se corrige con otro en sentido contrario, nunca borrando.',
    span: 'md:col-span-1',
  },
] as const

const SUCURSALES = [
  { nombre: 'Sucursal A', cuartos: ['101', '102', '103'], tono: 'emerald' as const },
  { nombre: 'Sucursal B', cuartos: ['201', '202'], tono: 'indigo' as const },
]

function TarjetaBento({ item }: { item: (typeof BENTO)[number] }) {
  const Icono = item.icono
  const esAncla = item.id === 'aislamiento'

  return (
    <article
      className={cn(
        'group flex flex-col bg-white p-6 dark:bg-zinc-950',
        RADIO,
        CANTO,
        ELEV.reposo,
        item.span,
        // motion.csv > Hover Micro-interaction (Standard): 200-300ms, y:-4,
        // escala 1.02. Solo transform y sombra: se queda en el compositor.
        'transition-[transform,box-shadow] duration-200 ease-out',
        'hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_12px_24px_rgba(0,0,0,0.12)]',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100',
      )}
    >
      <span
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-xl',
          CANTO,
          'bg-zinc-50 dark:bg-zinc-900',
        )}
        aria-hidden
      >
        <Icono className="h-4 w-4" />
      </span>

      <h3 className="mt-5 text-[1.0625rem] font-semibold leading-tight tracking-tight">
        {item.titulo}
      </h3>
      <p className={cn('mt-2 text-pretty text-[0.9375rem] leading-[1.6]', SUAVE)}>{item.texto}</p>

      {esAncla ? (
        // La tarjeta ancla del bento gana una prueba visual: dos sucursales y lo
        // que cada una alcanza a ver. Es la diferencia entre afirmarlo y
        // enseñarlo.
        <div className="mt-6 grid flex-1 grid-cols-2 items-end gap-3">
          {SUCURSALES.map((sucursal) => (
            <div
              key={sucursal.nombre}
              className={cn('rounded-xl p-3', CANTO, 'bg-zinc-50/60 dark:bg-zinc-900/40')}
            >
              <p className={cn(ETIQUETA_SECCION, 'text-[0.625rem]')}>{sucursal.nombre}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {sucursal.cuartos.map((cuarto) => (
                  <span
                    key={cuarto}
                    className={cn(
                      'rounded-md px-1.5 py-0.5 font-mono text-[0.625rem] tabular',
                      sucursal.tono === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
                    )}
                  >
                    {cuarto}
                  </span>
                ))}
                <span
                  className={cn(
                    'rounded-md border border-dashed border-zinc-300 px-1.5 py-0.5 font-mono text-[0.625rem] dark:border-zinc-700',
                    SUAVE,
                  )}
                >
                  vacío
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  )
}

/* -------------------------------------------------------------------- página */

function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg',
          CANTO,
          'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900',
        )}
        aria-hidden
      >
        <LuBed className="h-3.5 w-3.5" />
      </span>
      <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {APP_FALLBACK_NAME}
      </span>
    </span>
  )
}

const BOTON_PRINCIPAL = cn(
  'group inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6',
  'bg-zinc-900 text-[0.9375rem] font-medium text-white',
  'shadow-[0_4px_6px_rgba(0,0,0,0.1)] dark:shadow-none',
  'transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-zinc-700',
  'dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
)

export default function LandingPage() {
  const [paso, setPaso] = useState(APAGADO)
  // `lg` es donde la columna pegajosa deja de caber junto al texto.
  const angosta = useMediaQuery('(max-width: 1023px)')

  useEffect(() => {
    document.title = `${APP_FALLBACK_NAME} · Hospedaje y estancias ágiles`
  }, [])

  return (
    <div className="min-h-dvh bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white dark:focus:bg-zinc-100 dark:focus:text-zinc-900"
      >
        Saltar al contenido
      </a>

      <header
        className={cn(
          'sticky top-0 z-30 border-b',
          BORDE,
          'bg-white/80 backdrop-blur-[8px] dark:bg-zinc-950/80',
        )}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Marca />
          <span
            className={cn(
              'hidden whitespace-nowrap rounded-md px-1.5 py-1 sm:inline-block',
              CANTO,
              ETIQUETA_SECCION,
              'text-[0.625rem]',
            )}
          >
            SaaS v2.0
          </span>

          <div className="ml-auto flex items-center gap-1">
            <a
              href="#como-funciona"
              className={cn(
                'hidden rounded-lg px-3 py-2 text-sm transition-colors duration-200 sm:block',
                SUAVE,
                'hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
              )}
            >
              Cómo funciona
            </a>
            <Link
              to="/login"
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors duration-200',
                SUAVE,
                'hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
              )}
            >
              Entrar
            </Link>
            <Link
              to="/registro"
              className={cn(
                'whitespace-nowrap rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white',
                'transition-colors duration-200 hover:bg-zinc-700',
                'dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
              )}
            >
              Crear cuenta
            </Link>
          </div>
        </nav>
      </header>

      <main id="contenido">
        {/* ---------------------------------------------------------- hero */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className={cn(
                'mx-auto mb-7 inline-flex items-center gap-2 rounded-full px-3 py-1.5',
                CANTO,
                ETIQUETA_SECCION,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Hospitalidad por turnos
            </p>

            {/* typography.csv #61: hero 36-42px con interlínea 1.1. */}
            <h1 className="text-balance text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[3.25rem]">
              Control operativo de habitaciones, sin fricción en el mostrador.
            </h1>

            <p
              className={cn(
                'mx-auto mt-7 max-w-xl text-pretty text-[1.0625rem] leading-[1.6] sm:text-[1.125rem]',
                SUAVE,
              )}
            >
              Sistema de gestión de hospedaje y estancias ágiles: ocupación en vivo, folios de
              consumo, cortes de caja por turno y rotación de limpieza en una sola pantalla.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/registro" className={cn(BOTON_PRINCIPAL, 'w-full sm:w-auto')}>
                Crear cuenta y configurar
                <LuArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
              <a
                href="#como-funciona"
                className={cn(
                  'inline-flex h-12 w-full items-center justify-center rounded-xl px-6 sm:w-auto',
                  CANTO,
                  'text-[0.9375rem] font-medium transition-colors duration-200',
                  'hover:bg-zinc-50 dark:hover:bg-zinc-900',
                )}
              >
                Ver cómo funciona
              </a>
            </div>

            <p className={cn('mt-6', ETIQUETA_SECCION)}>
              4 pasos de configuración · sin instalar nada
            </p>
          </div>
        </section>

        {/* -------------------------------------------------- escaparate */}
        <section
          id="como-funciona"
          className={cn('border-t bg-zinc-50/60 dark:bg-zinc-900/20', BORDE)}
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="max-w-xl">
              <p className={ETIQUETA_SECCION}>El recorrido</p>
              {/* typography.csv #61: H2 de sección 28-32px. */}
              <h2 className="mt-4 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[2rem]">
                Del alta al primer corte de caja
              </h2>
              <p className={cn('mt-4 text-pretty text-[1.0625rem] leading-[1.6]', SUAVE)}>
                El tablero es el mismo que ve el personal.{' '}
                <span className="lg:hidden">Elige un paso y míralo encenderse.</span>
                <span className="hidden lg:inline">Se va encendiendo conforme bajas.</span>
              </p>
            </div>

            <div className="mt-12">
              {angosta ? (
                <EscaparateTactil paso={paso} onPaso={setPaso} />
              ) : (
                <EscaparateDeEscritorio paso={paso} onPaso={setPaso} />
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ bento de confianza */}
        <section className={cn('border-t', BORDE)}>
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="max-w-xl">
              <p className={ETIQUETA_SECCION}>Lo que no se apaga</p>
              <h2 className="mt-4 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[2rem]">
                Lo que separa un sistema de una hoja de cálculo
              </h2>
              <p className={cn('mt-4 text-pretty text-[1.0625rem] leading-[1.6]', SUAVE)}>
                Cuatro reglas que no se pueden desactivar desde la interfaz.
              </p>
            </div>

            {/* bento-box-grid: rejilla 4→2→1, spans variados, gap de 16px. */}
            <div className="mt-12 grid grid-cols-1 gap-4 md:auto-rows-[minmax(11rem,auto)] md:grid-cols-4">
              {BENTO.map((item) => (
                <TarjetaBento key={item.id} item={item} />
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- cierre */}
        <section className={cn('border-t', BORDE)}>
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <div
              className={cn(
                'mx-auto max-w-3xl px-6 py-14 text-center sm:px-12',
                RADIO,
                CANTO,
                ELEV.media,
                'bg-zinc-50 dark:bg-zinc-900/40',
              )}
            >
              <h2 className="text-balance text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[2rem]">
                Tu tablero puede estar operando en cuatro pasos.
              </h2>
              <p
                className={cn(
                  'mx-auto mt-4 max-w-md text-pretty text-[1.0625rem] leading-[1.6]',
                  SUAVE,
                )}
              >
                Das de alta el negocio, defines tipos y tarifas, cargas las habitaciones y recepción
                empieza a rentar.
              </p>
              <Link to="/registro" className={cn(BOTON_PRINCIPAL, 'mt-8')}>
                Crear cuenta y configurar
                <LuArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={cn('border-t', BORDE)}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 sm:flex-row sm:px-6">
          <Marca />
          <div className={cn('flex items-center gap-4 text-sm sm:ml-auto', SUAVE)}>
            <Link
              to="/login"
              className="transition-colors duration-200 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Entrar
            </Link>
            <Link
              to="/registro"
              className="transition-colors duration-200 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Crear cuenta
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <LuDoorOpen className="h-3.5 w-3.5" aria-hidden />
              Hospedaje por turnos
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
