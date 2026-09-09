import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined
  /** Qué se dibuja cuando no hay imagen que dibujar. */
  fallback: ReactNode
}

/**
 * Una imagen que nunca deja el ícono de "imagen rota" en pantalla.
 *
 * El disco del servidor es efímero: cada despliegue se lleva lo que se subió,
 * así que la fila en la base de datos sigue apuntando a un archivo que ya no
 * existe. El navegador entonces dibuja su ícono roto -- distinto en cada
 * navegador, siempre feo -- justo en el logotipo de la esquina, que es lo
 * primero que se ve al entrar.
 *
 * `onError` no es un detalle opcional en este despliegue: es el caso normal
 * pasado un tiempo. Cuando la carga falla, o cuando no hay `src`, se dibuja el
 * respaldo que ya existía para "todavía no hay logotipo". El hueco mide lo
 * mismo en los dos casos, así que nada se recorre al fallar.
 */
export function ImageWithFallback({ src, fallback, alt = '', ...props }: Props) {
  const [falló, setFalló] = useState(false)

  // Otra imagen en el mismo hueco merece su propia oportunidad: al cambiar de
  // sucursal, o al elegir un archivo nuevo, el fallo anterior ya no aplica.
  useEffect(() => setFalló(false), [src])

  if (!src || falló) return <>{fallback}</>

  return <img src={src} alt={alt} onError={() => setFalló(true)} {...props} />
}
