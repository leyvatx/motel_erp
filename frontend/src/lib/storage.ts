/** Mueve lo guardado de una clave vieja a la nueva, una sola vez.
 *
 *  Renombrar la clave de un store de zustand sin esto es cerrarle la sesión y
 *  borrarle las preferencias a todo el que ya tenía el sistema abierto. Corre
 *  antes de que el store lea, así que la primera lectura ya encuentra su dato.
 */
export function migrateStorageKey(legacy: string, current: string): void {
  try {
    const guardado = window.localStorage.getItem(legacy)
    if (guardado === null) return
    if (window.localStorage.getItem(current) === null) {
      window.localStorage.setItem(current, guardado)
    }
    window.localStorage.removeItem(legacy)
  } catch {
    /* Navegador con el almacenamiento bloqueado: se arranca sin preferencias. */
  }
}
