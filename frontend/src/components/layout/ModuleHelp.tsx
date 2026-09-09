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
    titulo: 'recepcion.comoUsarRecepcion',
    proposito: 'recepcion.aquiSeVeElEstado',
    pasos: [
      'recepcion.buscaLaHabitacion',
      'recepcion.tocaLaAccion',
      'recepcion.paraTodoLoDemas',
      'recepcion.elCronometro',
    ],
    notas: ['recepcion.elColorDeLaFranja', 'caja.consumosSeCobranAlCheckout'],
  },
  caja: {
    titulo: 'caja.comoUsarCaja',
    proposito: 'caja.aquiSeVenden',
    pasos: [
      'caja.abreTuTurno',
      'caja.eligeSiElConsumo',
      'caja.tocaLosProductos',
      'caja.cobraEligeMetodo',
    ],
    notas: [
      'Si falta un producto, créalo desde aquí con "Nuevo producto" y se agrega a la venta.',
      'caja.cortesSeConsultan',
    ],
  },
  limpieza: {
    titulo: 'limpieza.comoUsarLimpieza',
    proposito: 'limpieza.aquiEstaTuLista',
    pasos: [
      'Toca "Empezar" en la habitación que vas a limpiar. El tiempo empieza a correr.',
      'Al terminar, toca "Lista" y el cuarto queda disponible para rentarse.',
      'Si algo está roto o falta, toca "Problema": puedes tomar una foto y describirlo.',
      'limpieza.siguienteAparecesSola',
    ],
    notas: ['limpieza.reporteUrgente'],
  },
  inventario: {
    titulo: 'inventario.comoUsarInventarios',
    proposito: 'inventario.aquiSeVeQueHay',
    pasos: [
      'Empieza por "Bajo mínimo": son los productos que hay que resurtir.',
      'inventario.cuandoLlegueMercancia',
      'Si el conteo físico no cuadra, usa "Ajuste" y deja el motivo.',
      'inventario.loQueSeRompe',
    ],
    notas: ['inventario.todoMovimientoKardex'],
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
          aria-label={t(guia.titulo)}
          title={t(guia.titulo)}
        >
          <PiLightbulb />
          <span className="hidden lg:inline">{t('comun.comoUsar')}</span>
        </Button>
      )}

      <ResponsiveDialog
        open={abierta}
        onOpenChange={setAbierta}
        title={t(guia.titulo)}
        description={t(guia.proposito)}
        className="sm:max-w-lg"
        footer={<Button onClick={() => setAbierta(false)}>Entendido</Button>}
      >
        <div className="space-y-5">
          <ol className="space-y-3">
            {guia.pasos.map((paso, indice) => (
              <li key={t(paso)} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-2xs font-semibold text-brand-accent">
                  {indice + 1}
                </span>
                <p className="text-sm leading-relaxed">{t(paso)}</p>
              </li>
            ))}
          </ol>

          {guia.notas?.length ? (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3">
              {guia.notas.map((nota) => (
                <p key={t(nota)} className="text-xs leading-relaxed text-muted-foreground">
                  {t(nota)}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </ResponsiveDialog>
    </>
  )
}
