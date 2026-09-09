import { queryClient } from '@/lib/queryClient'
import { realtimeChannels } from '@/lib/websocket'
import { useAppearanceStore } from '@/store/appearance'
import { useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'

/** Los stores que escriben en el navegador. Se purgan por su propia API.
 *
 *  `localStorage.clear()` a secas no alcanza: el middleware `persist` de
 *  zustand conserva su copia en memoria y la vuelve a escribir en el siguiente
 *  `set()` -- que ocurre en cuanto React repinta -- así que la clave reaparece
 *  ya borrada. `clearStorage()` le dice al middleware que la suelte, y por eso
 *  va antes del barrido general y no después.
 */
const PERSISTIDOS = [useAuthStore, useUiStore, useAppearanceStore]

/**
 * Borra todo rastro de la sesión anterior en este navegador.
 *
 * Salir dejaba el nombre del negocio y sus colores puestos. Los caminos por los
 * que volvía eran tres, y bastaba con que uno sobreviviera: el store de sesión
 * conservaba el identificador de la sucursal, el tema resuelto seguía en
 * `localStorage` -- y lo aplica un guion que corre antes que React -- y la
 * consulta pública de la marca lo volvía a pedir en cuanto se limpiaba la
 * caché.
 *
 * Se borra `localStorage` entero a propósito. Estas terminales se comparten
 * entre turnos, y una preferencia recordada no vale lo que vale que el
 * siguiente en sentarse no vea nada del anterior. Lo que se pierde -- barra
 * lateral plegada, alertas con sonido, productos frecuentes -- se vuelve a
 * elegir en un toque.
 *
 * Después de esto hay que sacar al usuario de la pantalla en la que estaba;
 * quien llama decide si con el router o recargando.
 */
export function cerrarSesionLocal(): void {
  // Primero el socket: si sigue vivo puede pedir un ticket con el token que
  // estamos a punto de borrar y dejar un 401 rebotando por el interceptor.
  realtimeChannels.forEach((channel) => channel.disconnect())

  // El estado en memoria, y enseguida la copia del middleware. En este orden:
  // `clear()` dispara un `set()`, que persiste; si `clearStorage()` corriera
  // antes, esa escritura volvería a dejar la clave puesta.
  useAuthStore.getState().clear()
  for (const store of PERSISTIDOS) store.persist.clearStorage()

  try {
    window.localStorage.clear()
    window.sessionStorage.clear()
  } catch {
    // Almacenamiento bloqueado (modo privado, políticas del navegador). El
    // estado en memoria ya quedó limpio, que es lo que se ve en pantalla.
  }

  // Las cookies del dominio. Se intenta con cada ruta y cada nivel de dominio
  // porque una cookie solo se borra desde el mismo `path` y `domain` con que se
  // escribió, y desde aquí no se sabe cuáles fueron. Las HttpOnly no se pueden
  // tocar con guion y no hace falta: esas las retira el servidor al cerrar.
  try {
    const dominios = ['', location.hostname, `.${location.hostname}`]
    const rutas = ['/', location.pathname]
    for (const cookie of document.cookie.split(';')) {
      const nombre = cookie.split('=')[0]?.trim()
      if (!nombre) continue
      for (const path of rutas) {
        for (const domain of dominios) {
          document.cookie =
            `${nombre}=; Max-Age=0; path=${path}` + (domain ? `; domain=${domain}` : '')
        }
      }
    }
  } catch {
    /* Documento sin acceso a cookies. */
  }

  // La caché de consultas guarda el perfil del negocio, su logotipo y todo lo
  // que se vio en el turno. Se quita al final para que nada la vuelva a llenar
  // mientras se limpiaba lo demás.
  queryClient.clear()
}
