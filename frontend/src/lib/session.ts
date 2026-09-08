import { queryClient } from '@/lib/queryClient'
import { realtimeChannels } from '@/lib/websocket'
import { useAppearanceStore } from '@/store/appearance'
import { useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'

/**
 * Borra todo rastro de la sesión anterior en este navegador.
 *
 * Salir dejaba el nombre del negocio y sus colores puestos: el store de sesión
 * conservaba `motelSlug`, el tema resuelto seguía en `localStorage` y lo aplica
 * un guion que corre antes que React, y la consulta pública del negocio volvía
 * a pedir la marca de esa misma sucursal en cuanto se limpiaba la caché. Tres
 * caminos distintos para el mismo dato, y bastaba con que uno sobreviviera.
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

  useAuthStore.getState().clear()
  useUiStore.persist.clearStorage()
  useAppearanceStore.persist.clearStorage()

  try {
    window.localStorage.clear()
    window.sessionStorage.clear()
  } catch {
    // Almacenamiento bloqueado (modo privado, políticas del navegador). El
    // estado en memoria ya quedó limpio, que es lo que se ve en pantalla.
  }

  // Las cookies del dominio, por si alguna vez se sirve una de sesión. Las
  // HttpOnly no se pueden tocar desde aquí y no hace falta: esas las retira el
  // servidor al cerrar sesión.
  try {
    for (const cookie of document.cookie.split(';')) {
      const nombre = cookie.split('=')[0]?.trim()
      if (!nombre) continue
      document.cookie = `${nombre}=; Max-Age=0; path=/`
    }
  } catch {
    /* Documento sin acceso a cookies. */
  }

  // La caché de consultas guarda el perfil del negocio, su logotipo y todo lo
  // que se vio en el turno. Se quita al final para que nada la vuelva a llenar
  // mientras se limpiaba lo demás.
  queryClient.clear()
}
