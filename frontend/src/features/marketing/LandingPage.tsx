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
  LuSparkles,
  LuUser,
  LuVault,
} from 'react-icons/lu'

import { APP_FALLBACK_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------
 * Estado de la maqueta
 *
 * La columna derecha no es una imagen: es el mismo tablero que opera el
 * personal, pintado en función del paso que el visitante está leyendo. Los
 * cuatro estados están escritos a mano y son deterministas -- nada de datos al
 * azar -- porque la maqueta tiene que contar siempre la misma historia y
 * porque los porcentajes de la barra superior salen de contarlos.
 * ------------------------------------------------------------------------- */

type Estado = 'apagada' | 'libre' | 'ocupada' | 'limpieza'

interface Habitacion {
  numero: string
  tipo: string
  /** Huéspedes asignados. Solo cuenta cuando está ocupada. */
  huespedes: number
  /** Avance de la renta, de 0 a 100. Fijo por habitación, no aleatorio. */
  avance: number
  salida: string
  /** Estado en cada uno de los cuatro pasos. */
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

/** ``-1`` es el tablero antes de encenderse: la retícula en gris. */
const APAGADO = -1

function estadoEn(habitacion: Habitacion, paso: number): Estado {
  if (paso < 0) return 'apagada'
  return habitacion.linea[Math.min(paso, 3)] ?? 'libre'
}

const PASOS = [
  {
    titulo: 'Configuración relámpago',
    resumen: 'Tipos, tarifas y lote de habitaciones en un asistente de cuatro pasos.',
    detalle:
      'Se declara una vez cuánto dura y cuánto cuesta cada estancia. El tablero queda armado antes de que llegue el primer huésped, sin capturar cuarto por cuarto.',
    icono: LuLayoutGrid,
  },
  {
    titulo: 'Ocupación y tiempos en vivo',
    resumen: 'Quién entró, cuántos son y cuánto les queda, sin abrir nada.',
    detalle:
      'Cada tarjeta lleva su cronómetro y su barra de avance. Recepción ve de un vistazo cuál está por vencerse en lugar de revisar una lista de horas de salida.',
    icono: LuClock,
  },
  {
    titulo: 'Comandas y folios de consumo',
    resumen: 'Lo que se consume se carga a la cuenta del cuarto y descuenta inventario.',
    detalle:
      'El folio vive junto a la estancia. Cargar una comanda mueve el Kardex en el mismo movimiento, así que el corte de caja cuadra con el almacén sin conciliar a mano.',
    icono: LuReceipt,
  },
  {
    titulo: 'Rotación y control de limpieza',
    resumen: 'Al cobrar, el cuarto entra solo al tablero de ama de llaves.',
    detalle:
      'La salida dispara la tarea, la tarea libera el cuarto y las métricas de arriba se mueven en el momento. Nadie tiene que avisarle a nadie para que la rotación siga.',
    icono: LuSparkles,
  },
] as const

const CONFIANZA = [
  {
    titulo: 'Aislamiento por sucursal',
    icono: LuNetwork,
    texto:
      'El filtro por sucursal vive en la capa de datos, no en cada pantalla: una consulta que lo olvide no devuelve de más, devuelve vacío. Hay pruebas de regresión que lo verifican en lectura y en escritura.',
  },
  {
    titulo: 'Roles jerárquicos',
    icono: LuLock,
    texto:
      'Cada acción sensible declara qué permiso exige. Recepción cobra pero no ve costos ni márgenes; ama de llaves opera su tablero y nada más. La matriz se consulta, no se adivina.',
  },
  {
    titulo: 'Cortes de caja ciegos',
    icono: LuVault,
    texto:
      'Quien cierra el turno captura el efectivo contado sin ver lo que el sistema esperaba. La diferencia se calcula después y queda firmada, que es lo único que convierte un faltante en un dato.',
  },
] as const

/* -------------------------------------------------------------------------
 * Paleta de la maqueta
 *
 * Aquí sí van colores literales y no los tokens del tema. Esos son
 * configurables por cliente -- cada sucursal elige los cuatro colores de
 * estado -- y esta página es del producto, no de un cliente: tiene que verse
 * igual para todo el que llegue.
 * ------------------------------------------------------------------------- */

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

const ETIQUETA: Record<Estado, string> = {
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

const BORDE = 'border-zinc-200/80 dark:border-zinc-800/80'
const SUAVE = 'text-zinc-500 dark:text-zinc-400'

/* ------------------------------------------------------------------ maqueta */

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
        <span className={cn('truncate text-[0.625rem] font-medium uppercase tracking-wide', SUAVE)}>
          {etiqueta}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold leading-none tracking-tight tabular text-zinc-900 dark:text-zinc-100">
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

  return (
    <div
      className={cn(
        'relative flex min-h-[5.5rem] flex-col overflow-hidden rounded-lg border p-2.5',
        'transition-colors duration-500 motion-reduce:transition-none',
        TARJETA[estado],
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="font-mono text-base font-medium leading-none tracking-tight tabular text-zinc-900 dark:text-zinc-100">
            {habitacion.numero}
          </p>
          <p className={cn('mt-1 truncate text-[0.625rem] leading-none', SUAVE)}>
            {habitacion.tipo}
          </p>
        </div>

        {/* Microavatares: uno por huésped, y solo cuando hay estancia. */}
        <span
          className={cn(
            'flex -space-x-1 transition-opacity duration-500 motion-reduce:transition-none',
            ocupada ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden
        >
          {Array.from({ length: ocupada ? habitacion.huespedes : 0 }, (_, indice) => (
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
              'inline-flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-wide',
              'transition-colors duration-500 motion-reduce:transition-none',
              ETIQUETA[estado],
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

        {/* Barra de avance de la renta. Ocupa su lugar siempre para que
            encenderla no mueva la tarjeta de sitio. */}
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
        'pointer-events-none absolute inset-y-3 right-3 w-[13.5rem] rounded-lg border p-3',
        'bg-white/95 backdrop-blur-sm dark:bg-zinc-950/95',
        BORDE,
        'shadow-lg shadow-zinc-900/5',
        'transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none',
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

      <div className="mt-2.5 flex h-7 items-center justify-center rounded-md bg-zinc-900 text-[0.6875rem] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
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
      className={cn(
        'relative overflow-hidden rounded-xl border bg-white dark:bg-zinc-950',
        BORDE,
        'shadow-sm shadow-zinc-900/5',
      )}
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
        <span className={cn('text-[0.625rem] font-medium tracking-tight', SUAVE)}>
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

/* ------------------------------------------------------------------ página */

function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md border',
          BORDE,
          'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900',
        )}
        aria-hidden
      >
        <LuBed className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {APP_FALLBACK_NAME}
      </span>
    </span>
  )
}

export default function LandingPage() {
  const [paso, setPaso] = useState(APAGADO)
  const pasosRef = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    document.title = `${APP_FALLBACK_NAME} · Hospedaje y estancias ágiles`
  }, [])

  useEffect(() => {
    // La franja del 45 % arriba y abajo deja viva una banda de un 10 % en el
    // centro de la pantalla, y el paso que la cruza es el que manda.
    //
    // En el límite entre dos pasos la cruzan los dos a la vez -- son contiguos
    // y la banda mide menos que cualquiera de ellos -- así que hace falta una
    // regla, no quedarse con el primero que reporte el navegador: ahí es donde
    // aparecerían los parpadeos. Gana el que va primero en el documento, que da
    // la histéresis correcta en las dos direcciones. Bajando, el paso en curso
    // aguanta hasta salirse de la banda, o sea hasta que el siguiente ya ocupa
    // casi todo el centro; subiendo, el de arriba toma el relevo en cuanto
    // asoma, que es justo lo que el ojo está siguiendo.
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
        if (indices.length > 0) setPaso(indices[0] as number)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )

    const nodos = pasosRef.current.filter((nodo): nodo is HTMLElement => nodo !== null)
    nodos.forEach((nodo) => observador.observe(nodo))
    return () => observador.disconnect()
  }, [])

  return (
    <div className="min-h-dvh bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <header
        className={cn(
          'sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md dark:bg-zinc-950/85',
          BORDE,
        )}
      >
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Marca />
          <span
            className={cn(
              'hidden rounded-md border px-1.5 py-0.5 font-mono text-[0.625rem] tabular sm:inline-block',
              BORDE,
              SUAVE,
            )}
          >
            SaaS v2.0
          </span>

          <div className="ml-auto flex items-center gap-1">
            <a
              href="#como-funciona"
              className={cn(
                'hidden rounded-md px-3 py-1.5 text-sm transition-colors duration-200 sm:block',
                SUAVE,
                'hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
              )}
            >
              Cómo funciona
            </a>
            <Link
              to="/login"
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors duration-200',
                SUAVE,
                'hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
              )}
            >
              Entrar
            </Link>
            <Link
              to="/registro"
              className={cn(
                'rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white',
                'transition-colors duration-200 hover:bg-zinc-700',
                'dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
              )}
            >
              Crear cuenta
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ------------------------------------------------------------ hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
          <div className="mx-auto max-w-2xl text-center">
            <p
              className={cn(
                'mx-auto mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                BORDE,
                SUAVE,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Plataforma de hospitalidad por turnos
            </p>

            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Control operativo de habitaciones, sin fricción en el mostrador.
            </h1>

            <p
              className={cn(
                'mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed sm:text-lg',
                SUAVE,
              )}
            >
              Sistema de gestión de hospedaje y estancias ágiles: ocupación en vivo, folios de
              consumo, cortes de caja por turno y rotación de limpieza en una sola pantalla.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/registro"
                className={cn(
                  'group inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-6 sm:w-auto',
                  'bg-zinc-900 text-sm font-medium text-white transition-colors duration-200',
                  'hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
                )}
              >
                Crear cuenta y configurar
                <LuArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
              <a
                href="#como-funciona"
                className={cn(
                  'inline-flex h-11 w-full items-center justify-center rounded-md border px-6 sm:w-auto',
                  BORDE,
                  'text-sm font-medium transition-colors duration-200',
                  'hover:bg-zinc-50 dark:hover:bg-zinc-900',
                )}
              >
                Ver cómo funciona
              </a>
            </div>

            <p className={cn('mt-5 font-mono text-xs tabular', SUAVE)}>
              4 pasos de configuración · sin instalar nada
            </p>
          </div>
        </section>

        {/* --------------------------------------------------- escaparate */}
        <section id="como-funciona" className={cn('border-t', BORDE)}>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Del alta al primer corte de caja
              </h2>
              <p className={cn('mt-3 text-pretty leading-relaxed', SUAVE)}>
                El tablero de la derecha es el mismo que ve el personal. Se va encendiendo conforme
                bajas.
              </p>
            </div>

            <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
              {/* La maqueta va primero en pantallas angostas: pegada arriba,
                  acompaña la lectura de los pasos que quedan debajo. */}
              <div className="order-first lg:order-last">
                <div className="sticky top-20">
                  <Tablero paso={paso} />
                  <ol className="mt-4 flex gap-1.5" aria-hidden>
                    {PASOS.map((item, indice) => (
                      <li
                        key={item.titulo}
                        className={cn(
                          'h-0.5 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none',
                          indice <= paso
                            ? 'bg-zinc-900 dark:bg-zinc-100'
                            : 'bg-zinc-200 dark:bg-zinc-800',
                        )}
                      />
                    ))}
                  </ol>
                </div>
              </div>

              <div className="lg:pb-[30vh] lg:pt-[10vh]">
                {PASOS.map((item, indice) => {
                  const activo = paso === indice
                  const Icono = item.icono
                  return (
                    <section
                      key={item.titulo}
                      ref={(nodo) => {
                        pasosRef.current[indice] = nodo
                      }}
                      className="flex min-h-[60vh] flex-col justify-center py-10 lg:min-h-[70vh]"
                    >
                      <div
                        className={cn(
                          'border-l-2 pl-5 transition-colors duration-500 motion-reduce:transition-none',
                          activo
                            ? 'border-zinc-900 dark:border-zinc-100'
                            : 'border-zinc-200 dark:border-zinc-800',
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'font-mono text-xs tabular transition-colors duration-500 motion-reduce:transition-none',
                              activo ? 'text-zinc-900 dark:text-zinc-100' : SUAVE,
                            )}
                          >
                            0{indice + 1}
                          </span>
                          <Icono
                            className={cn(
                              'h-4 w-4 transition-colors duration-500 motion-reduce:transition-none',
                              activo
                                ? 'text-zinc-900 dark:text-zinc-100'
                                : 'text-zinc-400 dark:text-zinc-600',
                            )}
                            aria-hidden
                          />
                        </div>

                        <h3
                          className={cn(
                            'mt-3 text-xl font-semibold tracking-tight transition-colors duration-500 sm:text-2xl motion-reduce:transition-none',
                            activo
                              ? 'text-zinc-900 dark:text-zinc-100'
                              : 'text-zinc-400 dark:text-zinc-600',
                          )}
                        >
                          {item.titulo}
                        </h3>

                        <p
                          className={cn(
                            'mt-2 text-pretty font-medium leading-relaxed transition-colors duration-500 motion-reduce:transition-none',
                            activo
                              ? 'text-zinc-700 dark:text-zinc-300'
                              : 'text-zinc-400 dark:text-zinc-600',
                          )}
                        >
                          {item.resumen}
                        </p>

                        <p
                          className={cn(
                            'mt-3 text-pretty text-sm leading-relaxed transition-colors duration-500 motion-reduce:transition-none',
                            activo ? SUAVE : 'text-zinc-300 dark:text-zinc-700',
                          )}
                        >
                          {item.detalle}
                        </p>
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ confianza */}
        <section className={cn('border-t', BORDE)}>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Lo que separa un sistema de una hoja de cálculo
              </h2>
              <p className={cn('mt-3 text-pretty leading-relaxed', SUAVE)}>
                Tres reglas que no se pueden apagar desde la interfaz.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {CONFIANZA.map((item) => {
                const Icono = item.icono
                return (
                  <div
                    key={item.titulo}
                    className={cn(
                      'rounded-xl border p-5 transition-colors duration-500 motion-reduce:transition-none',
                      BORDE,
                      'hover:border-zinc-300 dark:hover:border-zinc-700',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-md border',
                        BORDE,
                      )}
                      aria-hidden
                    >
                      <Icono className="h-4 w-4" />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold tracking-tight">{item.titulo}</h3>
                    <p className={cn('mt-2 text-pretty text-sm leading-relaxed', SUAVE)}>
                      {item.texto}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- cierre */}
        <section className={cn('border-t', BORDE)}>
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Tu tablero puede estar operando en cuatro pasos.
            </h2>
            <p className={cn('mx-auto mt-3 max-w-md text-pretty leading-relaxed', SUAVE)}>
              Das de alta el negocio, defines tipos y tarifas, cargas las habitaciones y recepción
              empieza a rentar.
            </p>
            <Link
              to="/registro"
              className={cn(
                'group mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-md px-6',
                'bg-zinc-900 text-sm font-medium text-white transition-colors duration-200',
                'hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
              )}
            >
              Crear cuenta y configurar
              <LuArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          </div>
        </section>
      </main>

      <footer className={cn('border-t', BORDE)}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 sm:flex-row sm:px-6">
          <Marca />
          <div className={cn('flex items-center gap-4 text-xs sm:ml-auto', SUAVE)}>
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
              <LuDoorOpen className="h-3 w-3" aria-hidden />
              Hospedaje por turnos
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
