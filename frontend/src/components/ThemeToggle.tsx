import { useEffect, useState } from 'react'
import { PiMoon, PiSun } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CLAVE_MODO, useAppearanceStore } from '@/store/appearance'

/** Lo que se está viendo ahora mismo, no lo que se prefirió.
 *
 *  La preferencia puede ser `system` o `business`, y de ninguna de las dos se
 *  deduce qué hay en pantalla sin mirar. El botón tiene que ofrecer lo
 *  contrario de lo que se ve: con `theme === 'business'` y una sucursal oscura,
 *  el primer clic ponía `dark` otra vez y no pasaba nada visible.
 */
function modoEnPantalla(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Claro y oscuro, para cualquiera.
 *
 * Vive fuera de la sesión: la preferencia se guarda en este navegador y manda
 * igual en la portada pública que dentro del sistema. Un visitante que llega a
 * las once de la noche puede bajarle a la pantalla sin tener cuenta.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const setTheme = useAppearanceStore((estado) => estado.setTheme)
  const preferencia = useAppearanceStore((estado) => estado.theme)
  const [modo, setModo] = useState(modoEnPantalla)

  // La clase la pone `applyAppearance` en un efecto, después de este render, y
  // también el guion que corre antes que React. Se vuelve a leer cuando cambia
  // algo que pueda haberla movido, para que el icono no quede al revés.
  useEffect(() => setModo(modoEnPantalla()), [preferencia])
  useEffect(() => {
    const observador = new MutationObserver(() => setModo(modoEnPantalla()))
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observador.disconnect()
  }, [])

  const siguiente = modo === 'dark' ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => {
        setTheme(siguiente)
        try {
          // Antes de que React repinte: así una recarga inmediata ya arranca
          // con lo elegido en vez de parpadear con lo anterior.
          localStorage.setItem(CLAVE_MODO, siguiente)
        } catch {
          /* Sin almacenamiento el cambio vale solo para esta pestaña. */
        }
      }}
      // 44x44 en el teléfono, que es el mínimo con el que un pulgar acierta.
      className={cn('h-11 w-11 lg:h-9 lg:w-9', className)}
      aria-label={siguiente === 'dark' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      title={siguiente === 'dark' ? 'Tema oscuro' : 'Tema claro'}
    >
      {modo === 'dark' ? <PiSun className="h-4 w-4" /> : <PiMoon className="h-4 w-4" />}
    </Button>
  )
}
