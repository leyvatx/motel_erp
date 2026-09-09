import { useTranslation } from 'react-i18next'
import { PiCheck, PiTranslate } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cambiarIdioma, idiomaActual, IDIOMAS } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Español o inglés, en cualquier pantalla y con o sin sesión.
 *
 * Discreto a propósito: dos letras, no una bandera. Una bandera dice país y el
 * idioma no es un país -- el inglés de una recepción en Tijuana no es el de
 * Londres -- y además obliga a elegir cuál poner, que es una discusión que no
 * lleva a ningún lado.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const activo = idiomaActual()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          // Mismo blanco de 44 px que el resto de los controles del móvil: el
          // pulgar no distingue entre un icono bonito y uno que se puede tocar.
          className={cn('h-11 w-11 gap-1 lg:h-9 lg:w-auto lg:px-2', className)}
          aria-label={t('idioma.etiqueta')}
          title={t('idioma.etiqueta')}
        >
          <PiTranslate className="h-4 w-4" aria-hidden />
          <span className="hidden text-2xs font-medium uppercase lg:inline">{activo}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        {IDIOMAS.map((idioma) => (
          <DropdownMenuItem
            key={idioma}
            onSelect={() => cambiarIdioma(idioma)}
            className="justify-between"
          >
            <span>
              <span className="mr-2 font-mono text-2xs uppercase text-muted-foreground">
                {idioma}
              </span>
              {t(`idioma.${idioma}`)}
            </span>
            {i18n.resolvedLanguage === idioma ? (
              <PiCheck className="h-3.5 w-3.5" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
