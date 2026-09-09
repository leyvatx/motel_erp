import i18n from '@/lib/i18n'

const CONFIGURADO = (import.meta.env.VITE_APP_NAME ?? '').trim()

/**
 * Cómo se llama el producto cuando todavía no hay negocio que lo nombre.
 *
 * Se ve en el arranque en frío, en la pantalla de acceso de una terminal nueva,
 * en la portada pública y en cuanto alguien cierra sesión. En cuanto la API dice
 * de qué negocio es la pantalla, manda ese nombre y este desaparece.
 *
 * Es una función y no una constante porque el idioma cambia sin recargar: una
 * constante se evalúa al importar el módulo y se queda con el idioma de ese
 * momento. Quien la use dentro de un componente debe leerla en cada render.
 *
 * `VITE_APP_NAME` sigue mandando cuando está puesta: quien despliega esto con
 * su propia marca no quiere que se le traduzca el nombre.
 */
export function nombreDelProducto(): string {
  return CONFIGURADO || i18n.t('producto.nombre')
}
