import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { APP_FALLBACK_NAME } from '@/lib/brand'
import { setFavicon } from '@/lib/favicon'
import { useAlcanceDeMarca } from '@/store/appearance'
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
const CANTO = 'border border-border ring-1 ring-inset ring-white/60 dark:ring-white/[0.04]'

/** Radio de tarjeta de `bento-box-grid`. */
const RADIO = 'rounded-[24px]'

/** Etiqueta de sección: 12px, mono, versalitas, tracking 1.5 (typography #61). */
const ETIQUETA_SECCION =
  'font-mono text-[0.75rem] uppercase leading-none tracking-[0.15em] text-muted-foreground'

const SUAVE = 'text-muted-foreground'
const BORDE = 'border-border'

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
    tipo: 'maqueta.tipoSencilla',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '102',
    tipo: 'maqueta.tipoDoble',
    huespedes: 2,
    avance: 92,
    salida: '14:30',
    linea: ['libre', 'ocupada', 'ocupada', 'limpieza'],
  },
  {
    numero: '103',
    tipo: 'maqueta.tipoSencilla',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '104',
    tipo: 'maqueta.tipoJacuzzi',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '201',
    tipo: 'maqueta.tipoDoble',
    huespedes: 2,
    avance: 41,
    salida: '17:00',
    linea: ['libre', 'ocupada', 'ocupada', 'ocupada'],
  },
  {
    numero: '202',
    tipo: 'maqueta.tipoSencilla',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '203',
    tipo: 'maqueta.tipoJacuzzi',
    huespedes: 0,
    avance: 0,
    salida: '',
    linea: ['libre', 'libre', 'libre', 'libre'],
  },
  {
    numero: '204',
    tipo: 'maqueta.tipoDoble',
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

/* Los pasos guardan su clave, no su texto.
 *
 *  El contenido vive en los catálogos de idioma; aquí solo queda lo que no se
 *  traduce -- el icono y el orden. Traer la cadena en el momento de pintar es
 *  lo que hace que el recorrido cambie de idioma con el selector, sin recargar
 *  y sin quedarse a medias entre dos idiomas. */
const PASOS = [
  { clave: 'alta', icono: LuLayoutGrid },
  { clave: 'ocupacion', icono: LuClock },
  { clave: 'consumo', icono: LuReceipt },
  { clave: 'rotacion', icono: LuSparkles },
] as const

const TARJETA: Record<Estado, string> = {
  apagada: 'border-border bg-muted/60',
  libre: 'border-status-available/30 bg-status-available/10',
  ocupada: 'border-brand-accent/30 bg-brand-accent/10',
  limpieza: 'border-status-cleaning/35 bg-status-cleaning/10',
}

const PUNTO: Record<Estado, string> = {
  apagada: 'bg-muted-foreground/40',
  libre: 'bg-status-available',
  ocupada: 'bg-brand-accent',
  limpieza: 'bg-status-cleaning',
}

const ETIQUETA_ESTADO: Record<Estado, string> = {
  apagada: 'text-muted-foreground/50',
  libre: 'text-status-available',
  ocupada: 'text-brand-accent',
  limpieza: 'text-status-cleaning',
}

/** Los estados de la maqueta, por clave. El guion largo no se traduce. */
const NOMBRE: Record<Estado, string | null> = {
  apagada: null,
  libre: 'maqueta.estadoLibre',
  ocupada: 'maqueta.estadoOcupada',
  limpieza: 'maqueta.estadoLimpieza',
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
              encendido ? punto : 'bg-muted-foreground/40',
            )}
            aria-hidden
          />
        ) : null}
        <span className={cn('truncate', ETIQUETA_SECCION, 'text-[0.625rem]')}>{etiqueta}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold leading-none tabular tracking-tight text-foreground">
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

/** Desde dónde una renta se lee como "se va a acabar". Es el mismo umbral con
 *  el que el cronómetro del producto se pone ámbar. */
const AVISO_DESDE = 85

function TarjetaHabitacion({ habitacion, paso }: { habitacion: Habitacion; paso: number }) {
  const { t } = useTranslation()
  const estado = estadoEn(habitacion, paso)
  const ocupada = estado === 'ocupada'
  const visibles = Math.min(habitacion.huespedes, MAX_AVATARES)

  /* "Por vencer" es el estado que hace hotelero a este negocio: no es que la
     habitación esté ocupada, es que se acaba en veinte minutos y hay que
     decidir si se extiende o se prepara la salida. Igual que en el producto, no
     cambia el color de la tarjeta -- sigue ocupada -- sino el del tiempo: lo
     que corre es la hora, no el cuarto. */
  const porVencer = ocupada && habitacion.avance >= AVISO_DESDE

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
          <p className="font-mono text-base font-medium leading-none tabular tracking-tight text-foreground">
            {habitacion.numero}
          </p>
          <p className={cn('mt-1 truncate text-[0.625rem] leading-none', SUAVE)}>
            {t(habitacion.tipo)}
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
              className="flex h-4 w-4 items-center justify-center rounded-full border border-background bg-brand-accent/25"
            >
              <LuUser className="h-2.5 w-2.5 text-brand-accent" />
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
              porVencer ? 'text-status-cleaning' : ETIQUETA_ESTADO[estado],
            )}
          >
            <span
              className={cn(
                'h-1 w-1 rounded-full transition-colors duration-500 motion-reduce:transition-none',
                porVencer ? 'bg-status-cleaning' : PUNTO[estado],
              )}
              aria-hidden
            />
            {porVencer ? t('maqueta.estadoPorVencer') : NOMBRE[estado] ? t(NOMBRE[estado]) : '—'}
          </span>

          <span
            className={cn(
              'font-mono text-[0.625rem] leading-none tabular transition-opacity duration-500 motion-reduce:transition-none',
              porVencer ? 'font-medium text-status-cleaning' : SUAVE,
              ocupada ? 'opacity-100' : 'opacity-0',
            )}
          >
            {habitacion.salida}
          </span>
        </div>

        <div
          className={cn(
            'mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10',
            'transition-opacity duration-500 motion-reduce:transition-none',
            ocupada ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none',
              porVencer ? 'bg-status-cleaning' : 'bg-brand-accent/70',
            )}
            style={{ width: `${ocupada ? habitacion.avance : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function PanelFolio({ visible }: { visible: boolean }) {
  const { t } = useTranslation()
  const cargos = [
    { concepto: 'maqueta.cargoCerveza', cantidad: 2, importe: '90.00' },
    { concepto: 'maqueta.cargoBotana', cantidad: 1, importe: '65.00' },
    { concepto: 'maqueta.cargoEstancia', cantidad: 1, importe: '350.00' },
  ]

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute inset-y-3 right-3 w-[13.5rem] rounded-2xl p-3',
        'bg-background/95 backdrop-blur-[8px]',
        CANTO,
        ELEV.alta,
        'transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
        visible ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0',
      )}
    >
      <div className={cn('flex items-baseline justify-between border-b pb-2', BORDE)}>
        <span className="text-xs font-medium tracking-tight text-foreground">
          {t('maqueta.folio')}
        </span>
        <span className={cn('font-mono text-[0.625rem] tabular', SUAVE)}>F-00218</span>
      </div>

      <ul className="mt-2 space-y-1.5">
        {cargos.map((cargo) => (
          <li key={cargo.concepto} className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[0.6875rem] text-muted-foreground">
              <span className={cn('font-mono tabular', SUAVE)}>{cargo.cantidad}×</span>{' '}
              {t(cargo.concepto)}
            </span>
            <span className="shrink-0 font-mono text-[0.6875rem] tabular text-foreground">
              {cargo.importe}
            </span>
          </li>
        ))}
      </ul>

      <div className={cn('mt-2 flex items-baseline justify-between border-t pt-2', BORDE)}>
        <span className="text-[0.6875rem] font-medium text-foreground">
          {t('maqueta.folioTotal')}
        </span>
        <span className="font-mono text-sm font-semibold tabular tracking-tight text-foreground">
          505.00
        </span>
      </div>

      <div className="mt-2.5 flex h-7 items-center justify-center rounded-lg bg-primary text-[0.6875rem] font-medium text-primary-foreground">
        {t('maqueta.cobrar')}
      </div>
    </div>
  )
}

function Tablero({ paso }: { paso: number }) {
  const { t } = useTranslation()
  const encendido = paso >= 0
  const estados = HABITACIONES.map((habitacion) => estadoEn(habitacion, paso))
  const total = HABITACIONES.length
  const contar = (estado: Estado): number => estados.filter((valor) => valor === estado).length
  const porcentaje = (valor: number): number | null =>
    encendido ? Math.round((valor / total) * 100) : null

  return (
    <div className={cn('relative overflow-hidden bg-background', RADIO, CANTO, ELEV.alta)}>
      <div className={cn('flex items-center gap-2 border-b px-4 py-2.5', BORDE)}>
        <span className="flex gap-1" aria-hidden>
          {['bg-muted-foreground/40', 'bg-border', 'bg-border'].map((tono, indice) => (
            <span key={indice} className={cn('h-2 w-2 rounded-full', tono)} />
          ))}
        </span>
        <span className={cn(ETIQUETA_SECCION, 'text-[0.625rem]')}>{t('maqueta.cabecera')}</span>
      </div>

      <div className={cn('flex items-start gap-3 border-b px-4 py-3', BORDE)}>
        <Metrica
          etiqueta={t('maqueta.total')}
          valor={total}
          porcentaje={null}
          encendido={encendido}
        />
        <Metrica
          etiqueta={t('maqueta.ocupadas')}
          valor={contar('ocupada')}
          porcentaje={porcentaje(contar('ocupada'))}
          punto="bg-brand-accent"
          encendido={encendido}
        />
        <Metrica
          etiqueta={t('maqueta.libres')}
          valor={contar('libre')}
          porcentaje={porcentaje(contar('libre'))}
          punto="bg-status-available"
          encendido={encendido}
        />
        <Metrica
          etiqueta={t('maqueta.porLimpiar')}
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
  const { t } = useTranslation()
  const item = PASOS[indice]
  if (!item) return null
  const Icono = item.icono

  return (
    <div
      className={cn(
        'border-l-2 pl-5 transition-colors duration-500 motion-reduce:transition-none',
        activo ? 'border-brand-accent' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'font-mono text-[0.75rem] tabular tracking-[0.15em] transition-colors duration-500 motion-reduce:transition-none',
            activo ? 'text-foreground' : SUAVE,
          )}
        >
          0{indice + 1}
        </span>
        <Icono
          className={cn(
            'h-4 w-4 transition-colors duration-500 motion-reduce:transition-none',
            activo ? 'text-foreground' : 'text-muted-foreground/50',
          )}
          aria-hidden
        />
      </div>

      {/* H3 dentro de la escala: bajo el H2 de sección (28-32) y sobre el
          cuerpo (16-18). */}
      <h3
        className={cn(
          'mt-3 text-[1.375rem] font-semibold leading-[1.15] tracking-[-0.015em] transition-colors duration-500 motion-reduce:transition-none sm:text-[1.5rem]',
          activo ? 'text-foreground' : 'text-muted-foreground/50',
        )}
      >
        {t(`pasos.${item.clave}Titulo`)}
      </h3>

      <p
        className={cn(
          'mt-2 text-pretty text-[1.0625rem] font-medium leading-[1.5] transition-colors duration-500 motion-reduce:transition-none',
          activo ? 'text-muted-foreground' : 'text-muted-foreground/50',
        )}
      >
        {t(`pasos.${item.clave}Resumen`)}
      </p>

      <p
        className={cn(
          'mt-3 text-pretty text-[0.9375rem] leading-[1.6] transition-colors duration-500 motion-reduce:transition-none',
          activo ? SUAVE : 'text-muted-foreground/40',
        )}
      >
        {t(`pasos.${item.clave}Detalle`)}
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
  const { t } = useTranslation()
  const actual = Math.max(paso, 0)

  return (
    <Tabs
      value={String(actual)}
      onValueChange={(valor) => onPaso(Number(valor))}
      className="space-y-4"
    >
      <Tablero paso={actual} />

      <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-xl bg-muted p-1">
        {PASOS.map((item, indice) => (
          <TabsTrigger
            key={item.clave}
            value={String(indice)}
            className={cn(
              'h-11 flex-col gap-0.5 rounded-lg px-1',
              'data-[state=active]:bg-background data-[state=active]:text-foreground',
            )}
          >
            <span className="font-mono text-[0.625rem] leading-none tabular tracking-[0.1em]">
              0{indice + 1}
            </span>
            <span className="text-[0.6875rem] leading-none">{t(`pasos.${item.clave}Corto`)}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {PASOS.map((item, indice) => (
        <TabsContent key={item.clave} value={String(indice)} className="mt-4">
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
                key={item.clave}
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none',
                  indice <= paso ? 'bg-primary' : 'bg-border',
                )}
              />
            ))}
          </ol>
        </div>
      </div>

      <div className="pb-[30vh] pt-[10vh]">
        {PASOS.map((item, indice) => (
          <section
            key={item.clave}
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
    clave: 'aislamiento',
    icono: LuNetwork,
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    id: 'roles',
    clave: 'roles',
    icono: LuLock,
    span: 'md:col-span-2',
  },
  {
    id: 'caja',
    clave: 'caja',
    icono: LuVault,
    span: 'md:col-span-1',
  },
  {
    id: 'bitacora',
    clave: 'bitacora',
    icono: LuScrollText,
    span: 'md:col-span-1',
  },
] as const

const SUCURSALES = [
  { nombre: 'confianza.sucursalA', cuartos: ['101', '102', '103'], tono: 'emerald' as const },
  { nombre: 'confianza.sucursalB', cuartos: ['201', '202'], tono: 'marca' as const },
]

function TarjetaBento({ item }: { item: (typeof BENTO)[number] }) {
  const { t } = useTranslation()
  const Icono = item.icono
  const esAncla = item.id === 'aislamiento'

  return (
    <article
      className={cn(
        'group flex flex-col bg-card p-6',
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
          'bg-muted',
        )}
        aria-hidden
      >
        <Icono className="h-4 w-4" />
      </span>

      <h3 className="mt-5 text-[1.25rem] font-semibold leading-tight tracking-[-0.02em]">
        {t(`confianza.${item.clave}Titulo`)}
      </h3>
      <p className={cn('mt-2 text-pretty text-[0.9375rem] leading-[1.6]', SUAVE)}>
        {t(`confianza.${item.clave}Texto`)}
      </p>

      {esAncla ? (
        // La tarjeta ancla del bento gana una prueba visual: dos sucursales y lo
        // que cada una alcanza a ver. Es la diferencia entre afirmarlo y
        // enseñarlo.
        <div className="mt-6 grid flex-1 grid-cols-2 items-end gap-3">
          {SUCURSALES.map((sucursal) => (
            <div key={sucursal.nombre} className={cn('rounded-xl p-3', CANTO, 'bg-muted/60')}>
              <p className={cn(ETIQUETA_SECCION, 'text-[0.625rem]')}>{t(sucursal.nombre)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {sucursal.cuartos.map((cuarto) => (
                  <span
                    key={cuarto}
                    className={cn(
                      'rounded-md px-1.5 py-0.5 font-mono text-[0.625rem] tabular',
                      sucursal.tono === 'emerald'
                        ? 'bg-status-available/10 text-status-available'
                        : 'bg-brand-accent/10 text-brand-accent',
                    )}
                  >
                    {cuarto}
                  </span>
                ))}
                <span
                  className={cn(
                    'rounded-md border border-dashed border-border px-1.5 py-0.5 font-mono text-[0.625rem]',
                    SUAVE,
                  )}
                >
                  {t('confianza.vacio')}
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
          'bg-primary text-primary-foreground',
        )}
        aria-hidden
      >
        <LuBed className="h-3.5 w-3.5" />
      </span>
      {/* El nombre desaparece en el teléfono y queda la marca sola. Con el
          tema, el idioma y el botón de alta, la franja no daba para 160 px de
          texto: se salía de la pantalla. El nombre sigue en el título de la
          pestaña y a dos dedos de scroll, en el titular. */}
      <span className="hidden whitespace-nowrap text-sm font-semibold tracking-tight text-foreground sm:inline">
        {APP_FALLBACK_NAME}
      </span>
    </span>
  )
}

/** Ruido en SVG, incrustado para no pedir una imagen más.
 *
 *  Un plano de color liso a pantalla completa se lee digital y barato. El grano
 *  es lo que le da cuerpo, igual que el papel a la tinta; a esta opacidad no se
 *  ve como textura, se percibe como profundidad. Va como `url()` completo
 *  porque el `backgroundImage` lo espera así. */
const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='r'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23r)'/%3E%3C/svg%3E\")"

/** Desvanecido inferior: la maqueta se corta con luz, no con un borde.
 *
 *  Sugiere que la pantalla sigue más abajo sin tener que dibujar un marco de
 *  navegador falso alrededor, que es el recurso que delata a una plantilla. */
const DESVANECIDO_INFERIOR = {
  maskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%)',
} as const

/** El pulso de un turno cualquiera, para la marquesina del hero.
 *
 *  No son datos reales de nadie: son los mismos sucesos que el sistema registra
 *  en un turno, escritos como los diría recepción. Sirven para que la página
 *  respire, no para informar. */
const PULSO = [
  { texto: 'pulso.renta', punto: 'bg-brand-accent' },
  { texto: 'pulso.limpieza', punto: 'bg-status-available' },
  { texto: 'pulso.corte', punto: 'bg-muted-foreground/60' },
  { texto: 'pulso.consumo', punto: 'bg-brand-accent' },
  { texto: 'pulso.vence', punto: 'bg-status-cleaning' },
  { texto: 'pulso.salida', punto: 'bg-status-available' },
  { texto: 'pulso.frigobar', punto: 'bg-muted-foreground/60' },
] as const

/** Hechos comprobables del sistema, a tamaño de titular. */
const HECHOS = ['pasos', 'relojes', 'pantalla'] as const

const BOTON_PRINCIPAL = cn(
  'group inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6',
  'bg-primary text-[0.9375rem] font-medium text-primary-foreground',
  'shadow-[0_4px_6px_rgba(0,0,0,0.1)] dark:shadow-none',
  'transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-primary/90',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
)

export default function LandingPage() {
  const { t } = useTranslation()
  const [paso, setPaso] = useState(APAGADO)
  // `lg` es donde la columna pegajosa deja de caber junto al texto.
  const angosta = useMediaQuery('(max-width: 1023px)')

  /* Esta pantalla es del producto, no de un negocio.
   *
   *  Lo declara mientras está montada para que la marca -- colores, ícono de la
   *  pestaña, nombre -- no salga de ningún motel. Volvía a aparecer aunque el
   *  usuario hubiera cerrado sesión, porque el color vive en `localStorage` y
   *  se aplica antes que React; ahora aquí manda lo neutro. */
  const setNeutra = useAlcanceDeMarca((estado) => estado.setNeutra)
  useEffect(() => {
    setNeutra(true)
    return () => setNeutra(false)
  }, [setNeutra])

  useEffect(() => {
    document.title = `${APP_FALLBACK_NAME} · ${t('portada.titulo')}`
    setFavicon(null)
  }, [t])

  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        {t('portada.saltarAlContenido')}
      </a>

      <header
        className={cn('sticky top-0 z-30 border-b', BORDE, 'bg-background/80 backdrop-blur-[8px]')}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Marca />

          <div className="ml-auto flex items-center gap-1">
            <a
              href="#como-funciona"
              className={cn(
                'hidden rounded-lg px-3 py-2 text-sm transition-colors duration-200 sm:block',
                SUAVE,
                'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {t('portada.comoFunciona')}
            </a>

            {/* Tema e idioma también aquí, sin sesión. Quien llega de noche
                puede bajarle a la pantalla y leerlo en su idioma antes de
                decidir si crea una cuenta. */}
            <ThemeToggle />
            <LanguageToggle />

            <Link
              to="/login"
              className={cn(
                // Oculto en el teléfono por espacio, no por importancia: quien
                // vuelve a entrar lo tiene en el cierre de la página y en la
                // ruta que ya conoce. Lo que no puede faltar arriba es la
                // acción de alguien que llega por primera vez.
                'hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors duration-200 sm:block',
                SUAVE,
                'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {t('portada.entrar')}
            </Link>
            <Link
              to="/registro"
              className={cn(
                'whitespace-nowrap rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground',
                'transition-colors duration-200 hover:bg-primary/90',
              )}
            >
              {t('portada.crearCuenta')}
            </Link>
          </div>
        </nav>
      </header>

      <main id="contenido">
        {/* ----------------------------------------------------------- hero
         *
         *  Titular a tamaño de cartel y el tablero encendido debajo, entrando
         *  por el borde inferior. Es la composición de una portada, no la de un
         *  formulario: quien llega tiene que entender de un vistazo qué es esto
         *  y verlo funcionando antes de decidir si sigue leyendo.
         *
         *  La escala va con `clamp` y no con saltos por punto de corte, porque
         *  a este tamaño un salto se nota como un brinco: el titular crece con
         *  la ventana, continuo, de 2.75 rem en un teléfono chico a 7 rem en un
         *  monitor de mostrador.
         */}
        <section className="relative overflow-hidden">
          {/* Un solo resplandor, del color que el negocio haya configurado. */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-32 h-[42rem] opacity-30 dark:opacity-[0.35]"
            style={{
              background:
                'radial-gradient(55rem 26rem at 50% 0%, hsl(var(--brand-accent)), transparent 68%)',
            }}
            aria-hidden
          />
          <div
            className="grid-surface grid-fade pointer-events-none absolute inset-0"
            aria-hidden
          />
          {/* Grano. Un plano de color liso a pantalla completa se ve digital y
              barato; el ruido le da cuerpo, como el papel a la tinta. Va tan
              bajo de opacidad que no se ve: se siente. */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay dark:opacity-[0.07]"
            style={{ backgroundImage: GRANO }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
            <div className="mx-auto max-w-4xl text-center">
              <p
                className={cn(
                  'mb-8 inline-flex items-center gap-2 rounded-full px-3 py-1.5',
                  CANTO,
                  ETIQUETA_SECCION,
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-status-available motion-safe:animate-pulse"
                  aria-hidden
                />
                {t('portada.heroEtiqueta')}
              </p>

              <h1 className="text-balance text-[clamp(2.75rem,8.5vw,7rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
                {t('portada.heroTituloA')}
                <br />
                <span className="text-brand-accent">{t('portada.heroTituloB')}</span>
              </h1>

              <p
                className={cn(
                  'mx-auto mt-8 max-w-xl text-pretty text-[1.0625rem] leading-[1.6] sm:text-[1.1875rem]',
                  SUAVE,
                )}
              >
                {t('portada.heroTexto')}
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/registro" className={cn(BOTON_PRINCIPAL, 'w-full px-7 sm:w-auto')}>
                  {t('portada.heroPrincipal')}
                  <LuArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Link>
                <a
                  href="#como-funciona"
                  className={cn(
                    'inline-flex h-12 w-full items-center justify-center rounded-xl px-7 sm:w-auto',
                    CANTO,
                    'text-[0.9375rem] font-medium transition-colors duration-200',
                    'hover:bg-accent',
                  )}
                >
                  {t('portada.heroSecundario')}
                </a>
              </div>
            </div>

            {/* El tablero entra por abajo y se desvanece: da a entender que la
                pantalla sigue, sin dibujar un navegador falso alrededor.
                `aria-hidden` porque es una fotografía del producto, no el
                producto: quien usa lector de pantalla no debe oír ocho
                habitaciones inventadas, y menos repetidas cuando llegue el
                tablero de verdad. */}
            <div className="relative mt-16 sm:mt-20" aria-hidden>
              <div
                className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 opacity-50 blur-3xl dark:opacity-40"
                style={{
                  background:
                    'radial-gradient(40rem 20rem at 50% 40%, hsl(var(--brand-accent) / 0.4), transparent 70%)',
                }}
              />
              <div className="relative mx-auto max-w-4xl" style={DESVANECIDO_INFERIOR}>
                <div
                  className={cn(
                    'rounded-t-[28px] p-4 sm:p-6',
                    CANTO,
                    ELEV.alta,
                    'bg-card/85 backdrop-blur-[8px]',
                  )}
                >
                  <Tablero paso={3} />
                </div>
              </div>
            </div>
          </div>

          {/* Marquesina: el pulso de un turno cualquiera. Se mueve despacio y se
              detiene con `prefers-reduced-motion`; es ambiente, no información
              que alguien tenga que perseguir con la vista. */}
          <div className={cn('relative mt-4 overflow-hidden border-y py-4', BORDE)}>
            <div className="flex w-max motion-safe:animate-deslizar">
              {[0, 1].map((copia) => (
                <ul key={copia} className="flex shrink-0 items-center gap-8 px-4">
                  {PULSO.map((evento) => (
                    <li
                      key={`${copia}-${evento.texto}`}
                      className={cn('flex items-center gap-2 whitespace-nowrap', ETIQUETA_SECCION)}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', evento.punto)}
                        aria-hidden
                      />
                      {t(evento.texto)}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- los hechos
         *
         *  Tres cifras a tamaño de titular. Son hechos comprobables del sistema
         *  -- no clientes ni facturación, que no tenemos -- porque inventar
         *  tracción es la forma más rápida de perder a quien sí iba a probarlo.
         */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <dl className="grid gap-12 sm:grid-cols-3 sm:gap-8">
            {HECHOS.map((clave) => (
              <div key={clave}>
                <dt className="flex items-baseline gap-2">
                  <span className="text-[clamp(3.5rem,7vw,5.5rem)] font-semibold leading-[0.85] tracking-[-0.05em] text-brand-accent">
                    {t(`hechos.${clave}Cifra`)}
                  </span>
                  <span className="text-[1.375rem] font-semibold tracking-tight">
                    {t(`hechos.${clave}Unidad`)}
                  </span>
                </dt>
                <dd
                  className={cn('mt-4 max-w-xs text-pretty text-[0.9375rem] leading-[1.6]', SUAVE)}
                >
                  {t(`hechos.${clave}Pie`)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* -------------------------------------------------- escaparate */}
        <section id="como-funciona" className={cn('border-t bg-muted/40', BORDE)}>
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="max-w-xl">
              <p className={ETIQUETA_SECCION}>{t('portada.recorridoEtiqueta')}</p>
              {/* typography.csv #61: H2 de sección 28-32px. */}
              <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
                {t('portada.recorridoTitulo')}
              </h2>
              <p className={cn('mt-4 text-pretty text-[1.0625rem] leading-[1.6]', SUAVE)}>
                {t('portada.recorridoTexto')}{' '}
                <span className="lg:hidden">{t('portada.recorridoTactil')}</span>
                <span className="hidden lg:inline">{t('portada.recorridoScroll')}</span>
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
              <p className={ETIQUETA_SECCION}>{t('portada.confianzaEtiqueta')}</p>
              <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
                {t('portada.confianzaTitulo')}
              </h2>
              <p className={cn('mt-4 text-pretty text-[1.0625rem] leading-[1.6]', SUAVE)}>
                {t('portada.confianzaTexto')}
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

        {/* ------------------------------------------------------- cierre
         *
         *  Banda oscura a sangre, siempre oscura -- también cuando la página va
         *  en claro. Después de tres secciones sobre fondo pálido, el corte es
         *  lo que hace que el último mensaje se lea como un final y no como una
         *  sección más; es el mismo recurso de la contraportada de un impreso.
         *
         *  Los colores van a mano y no por token justo por eso: no es "el tema
         *  oscuro" de la aplicación, es una pieza que se imprime en negro
         *  siempre. El acento sí sale de la marca del negocio.
         */}
        <section className="relative overflow-hidden bg-zinc-950 text-zinc-100">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[36rem] opacity-40"
            style={{
              background:
                'radial-gradient(50rem 24rem at 50% 100%, hsl(var(--brand-accent)), transparent 70%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
            style={{ backgroundImage: GRANO }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:px-6 sm:py-36">
            <p className={cn(ETIQUETA_SECCION, 'text-zinc-400')}>{t('portada.cierreEtiqueta')}</p>

            <h2 className="mt-6 text-balance text-[clamp(2.25rem,6.5vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
              {t('portada.cierreTituloA')}
              <br />
              <span className="text-brand-accent">{t('portada.cierreTituloB')}</span>
            </h2>

            <p className="mx-auto mt-7 max-w-lg text-pretty text-[1.0625rem] leading-[1.6] text-zinc-400 sm:text-[1.125rem]">
              {t('portada.cierreTexto')}
            </p>

            <div className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/registro"
                className={cn(
                  'group inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl px-8 sm:w-auto',
                  'bg-brand-accent text-[0.9375rem] font-medium text-white',
                  'transition-[transform,filter] duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110',
                  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                )}
              >
                {t('portada.cierrePrincipal')}
                <LuArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
              <Link
                to="/login"
                className={cn(
                  'inline-flex h-[3.25rem] w-full items-center justify-center rounded-xl px-8 sm:w-auto',
                  'border border-zinc-700 text-[0.9375rem] font-medium text-zinc-100',
                  'transition-colors duration-200 hover:bg-zinc-900',
                )}
              >
                {t('portada.cierreSecundario')}
              </Link>
            </div>

            <p className={cn(ETIQUETA_SECCION, 'mt-8 text-zinc-500')}>{t('portada.cierrePie')}</p>
          </div>
        </section>
      </main>

      <footer className={cn('border-t', BORDE)}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 sm:flex-row sm:px-6">
          <Marca />
          <div className={cn('flex items-center gap-4 text-sm sm:ml-auto', SUAVE)}>
            <Link to="/login" className="transition-colors duration-200 hover:text-foreground">
              {t('portada.entrar')}
            </Link>
            <Link to="/registro" className="transition-colors duration-200 hover:text-foreground">
              {t('portada.crearCuenta')}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <LuDoorOpen className="h-3.5 w-3.5" aria-hidden />
              {t('portada.pieRubro')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
