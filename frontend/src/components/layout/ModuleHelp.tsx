import { useEffect, useState } from 'react'
import { PiLightbulb } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { useUiStore } from '@/store/ui'

export type ModuloAyuda = 'recepcion' | 'caja' | 'limpieza' | 'inventario'

interface Guia {
  titulo: string
  /** Una frase: qué se resuelve aquí, en lenguaje de operación. */
  proposito: string
  pasos: string[]
  /** Lo que la gente pregunta la segunda vez, no la primera. */
  notas?: string[]
}

/** Lo que alguien necesita saber la primera vez que abre cada módulo.
 *
 *  No es documentación: son los pasos de la tarea principal, en el orden en que
 *  se hacen, con las palabras que se usan en el mostrador. Si un módulo
 *  necesitara doce pasos aquí, el problema estaría en el módulo. */
const GUIAS: Record<ModuloAyuda, Guia> = {
  recepcion: {
    titulo: 'Cómo usar Recepción',
    proposito: 'Aquí se ve el estado de todas las habitaciones y se opera sobre ellas.',
    pasos: [
      'Busca la habitación por número, placas o nombre del huésped.',
      'Toca la acción que dice la tarjeta: Rentar, Cobrar y salir, o Limpieza lista.',
      'Para todo lo demás -- extender tiempo, mantenimiento, ver la cuenta -- usa el botón ⋯ de la tarjeta.',
      'El cronómetro y la barra dicen cuánto falta. En rojo, la renta ya venció.',
    ],
    notas: [
      'El color de la franja superior es el estado: verde disponible, rojo ocupada, ámbar en limpieza.',
      'Los consumos cargados a la habitación se cobran al hacer el check-out, no antes.',
    ],
  },
  caja: {
    titulo: 'Cómo usar Caja',
    proposito: 'Aquí se venden productos, se registran gastos y se cierra el turno.',
    pasos: [
      'Abre tu turno contando el fondo de caja. Sin turno no se puede cobrar.',
      'Elige si el consumo se cobra ahora o se carga a una habitación.',
      'Toca los productos para agregarlos. También puedes escanear el código.',
      'Cobra: elige el método de pago y el sistema calcula el cambio.',
    ],
    notas: [
      'Si falta un producto, créalo desde aquí con "Nuevo producto" y se agrega a la venta.',
      'Los cortes anteriores se consultan aunque tu turno esté cerrado.',
    ],
  },
  limpieza: {
    titulo: 'Cómo usar Limpieza',
    proposito: 'Aquí está tu lista de habitaciones por limpiar y por dónde empezar.',
    pasos: [
      'Toca "Empezar" en la habitación que vas a limpiar. El tiempo empieza a correr.',
      'Al terminar, toca "Lista" y el cuarto queda disponible para rentarse.',
      'Si algo está roto o falta, toca "Problema": puedes tomar una foto y describirlo.',
      'La siguiente habitación aparece sola. No tienes que buscarla.',
    ],
    notas: [
      'Un reporte marcado como urgente saca la habitación de servicio hasta que se resuelva.',
    ],
  },
  inventario: {
    titulo: 'Cómo usar Inventarios',
    proposito: 'Aquí se ve qué hay, qué se está acabando y qué hay que comprar.',
    pasos: [
      'Empieza por "Bajo mínimo": son los productos que hay que resurtir.',
      'Cuando llegue mercancía, registra una entrada para que la existencia suba.',
      'Si el conteo físico no cuadra, usa "Ajuste" y deja el motivo.',
      'Lo que se rompe o caduca se registra como merma, no se borra.',
    ],
    notas: ['Todo movimiento queda en el Kardex con quién lo hizo y cuándo.'],
  },
}

interface Props {
  modulo: ModuloAyuda
  /** Un botón discreto en el encabezado; `link` para colgarlo de un estado vacío. */
  variant?: 'outline' | 'link'
}

/**
 * La ayuda de un módulo: botón visible, hoja inferior en el teléfono y diálogo
 * en escritorio, y apertura automática la primera vez que alguien entra.
 *
 * Automática **una sola vez** por módulo y por navegador. Quien ya sabe operar
 * no vuelve a ver nada; quien llega nuevo no tiene que descubrir dónde está la
 * ayuda justo cuando más perdido está. No hay recorrido guiado de doce pasos:
 * la pantalla ya está detrás y se puede cerrar en cualquier momento.
 */
export function ModuleHelp({ modulo, variant = 'outline' }: Props) {
  const { t } = useTranslation()
  const guia = GUIAS[modulo]
  const vistos = useUiStore((state) => state.ayudaVista)
  const marcarAyudaVista = useUiStore((state) => state.marcarAyudaVista)
  const [abierta, setAbierta] = useState(false)

  const primeraVez = !vistos[modulo]

  useEffect(() => {
    if (!primeraVez) return
    setAbierta(true)
    marcarAyudaVista(modulo)
  }, [primeraVez, modulo, marcarAyudaVista])

  return (
    <>
      {variant === 'link' ? (
        <Button variant="link" className="h-auto p-0" onClick={() => setAbierta(true)}>
          Ver cómo funciona
        </Button>
      ) : (
        <Button
          variant="outline"
          className="h-11 w-11 p-0 sm:h-9 sm:w-auto sm:px-3"
          onClick={() => setAbierta(true)}
          aria-label={guia.titulo}
          title={guia.titulo}
        >
          <PiLightbulb />
          <span className="hidden lg:inline">{t('comun.comoUsar')}</span>
        </Button>
      )}

      <ResponsiveDialog
        open={abierta}
        onOpenChange={setAbierta}
        title={guia.titulo}
        description={guia.proposito}
        className="sm:max-w-lg"
        footer={<Button onClick={() => setAbierta(false)}>Entendido</Button>}
      >
        <div className="space-y-5">
          <ol className="space-y-3">
            {guia.pasos.map((paso, indice) => (
              <li key={paso} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-2xs font-semibold text-brand-accent">
                  {indice + 1}
                </span>
                <p className="text-sm leading-relaxed">{paso}</p>
              </li>
            ))}
          </ol>

          {guia.notas?.length ? (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3">
              {guia.notas.map((nota) => (
                <p key={nota} className="text-xs leading-relaxed text-muted-foreground">
                  {nota}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </ResponsiveDialog>
    </>
  )
}
