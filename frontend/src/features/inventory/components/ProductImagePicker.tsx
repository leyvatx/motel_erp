import { useEffect, useRef, useState } from 'react'
import { PiCamera, PiTrash, PiUploadSimple } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { ProductThumb } from '@/features/inventory/productIcon'
import { cn } from '@/lib/utils'

/** El mismo tope que valida el servidor, para avisar antes de subir. */
const MAX_BYTES = 2 * 1024 * 1024

interface Props {
  /** Foto ya guardada del producto, si tiene. */
  actual?: string | null
  /** Nombre de la categoría: decide el ícono cuando no hay foto. */
  categoria?: string
  onChange: (archivo: File | null) => void
  className?: string
}

/**
 * Cómo se le pone cara a un producto.
 *
 * El supuesto que rompe este componente es que el usuario ya tenga fotos
 * preparadas. Casi nunca las tiene: está dando de alta un refresco con el
 * cliente enfrente. Por eso las tres salidas están al mismo nivel y ninguna es
 * obligatoria:
 *
 * - **Tomar foto** abre la cámara trasera directamente (`capture`), que en un
 *   teléfono es más rápido que buscar en la galería.
 * - **Subir** abre el explorador, que es lo que se espera en el mostrador.
 * - **Sin foto** no es un hueco: el sistema pone un ícono según la familia del
 *   producto, y una tarjeta con un ícono de botella se reconoce de reojo igual
 *   que una con foto.
 *
 * Buscar imágenes en la web queda fuera a propósito: exige un proveedor con
 * licencia y credencial por entorno, y una integración que no se puede probar
 * sin esa credencial es código que falla el día que se usa. El hueco está
 * documentado en el README; la forma del componente ya lo admite -- sería una
 * cuarta fuente que entrega un `File`.
 */
export function ProductImagePicker({ actual, categoria = '', onChange, className }: Props) {
  const subirRef = useRef<HTMLInputElement>(null)
  const camaraRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // El blob de una foto de cámara ocupa varios MB hasta que se suelta.
  useEffect(() => {
    if (!archivo) {
      setVistaPrevia(null)
      return
    }
    const url = URL.createObjectURL(archivo)
    setVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  const elegir = (elegido: File | undefined): void => {
    if (!elegido) return
    if (elegido.size > MAX_BYTES) {
      setError('La imagen pesa más de 2 MB. Toma una nueva o elige otra más ligera.')
      return
    }
    setError(null)
    setArchivo(elegido)
    onChange(elegido)
  }

  const quitar = (): void => {
    setArchivo(null)
    setError(null)
    onChange(null)
    if (subirRef.current) subirRef.current.value = ''
    if (camaraRef.current) camaraRef.current.value = ''
  }

  const muestra = vistaPrevia ?? actual ?? null

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={subirRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => elegir(event.target.files?.[0])}
      />
      <input
        ref={camaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => elegir(event.target.files?.[0])}
      />

      <div className="flex items-center gap-3">
        <ProductThumb
          src={muestra}
          categoria={categoria}
          className="h-20 w-20 shrink-0 rounded-lg border bg-muted/40"
          iconClassName="h-8 w-8 text-muted-foreground/70"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:h-10"
              onClick={() => camaraRef.current?.click()}
            >
              <PiCamera className="h-4 w-4" />
              Tomar foto
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:h-10"
              onClick={() => subirRef.current?.click()}
            >
              <PiUploadSimple className="h-4 w-4" />
              Subir
            </Button>
            {muestra ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 text-destructive sm:h-10 sm:w-10"
                aria-label="Quitar la imagen"
                onClick={quitar}
              >
                <PiTrash className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <p className="text-2xs leading-relaxed text-muted-foreground">
            {muestra
              ? 'Se ve en la tarjeta del punto de venta.'
              : 'Sin foto usamos un ícono según la categoría. Puedes agregarla después.'}
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
