const CONFIGURADO = (import.meta.env.VITE_APP_NAME ?? '').trim()

/** Nombre que se muestra mientras la API todavía no dice cuál es el negocio:
 *  arranque en frío, pantalla de acceso de una terminal nueva, o red caída. En
 *  cuanto responde el perfil del negocio manda ese, siempre. */
export const APP_FALLBACK_NAME = CONFIGURADO || 'Sistema de gestión'
