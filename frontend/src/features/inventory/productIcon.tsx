import { PiBeerBottle, PiCookie, PiPackage, PiSparkle, PiTShirt } from 'react-icons/pi'
import type { IconType } from 'react-icons'

/**
 * La cara de un producto que no tiene foto.
 *
 * No es un relleno: un ícono de botella se reconoce de reojo casi tan rápido
 * como una fotografía, y el catálogo real de un negocio de hospedaje se llena
 * despacio. Sin esto, quien todavía no sube fotos ve una cuadrícula de
 * rectángulos de texto idénticos y tiene que leer cada uno.
 *
 * Se decide por el nombre de la categoría porque es lo que el negocio ya
 * escribió; pedirle además que clasifique cada producto en una taxonomía
 * nuestra sería trabajo de captura a cambio de nada.
 */
const POR_FAMILIA: { patron: RegExp; icono: IconType }[] = [
  { patron: /bebida|refresc|cerveza|agua|licor|vino|jugo|caf/i, icono: PiBeerBottle },
  { patron: /botana|snack|dulce|comida|alimento|golosina/i, icono: PiCookie },
  { patron: /amenidad|limpieza|higiene|aseo/i, icono: PiSparkle },
  { patron: /ropa|blanco|toalla|textil|s[aá]bana/i, icono: PiTShirt },
]

export function iconoDeCategoria(categoria: string): IconType {
  return POR_FAMILIA.find(({ patron }) => patron.test(categoria))?.icono ?? PiPackage
}

export function ProductIcon({ categoria, className }: { categoria: string; className?: string }) {
  const Icono = iconoDeCategoria(categoria)
  return <Icono className={className} aria-hidden />
}
