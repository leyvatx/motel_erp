import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '@/locales/en.json'
import es from '@/locales/es.json'

export const IDIOMAS = ['es', 'en'] as const
export type Idioma = (typeof IDIOMAS)[number]

/** Dónde se recuerda el idioma de esta terminal. */
export const CLAVE_IDIOMA = 'erp-idioma'

/** El idioma con el que arranca, en orden de quién manda.
 *
 *  Primero lo que la persona eligió aquí; si nunca eligió, lo que pide su
 *  navegador; y si su navegador pide algo que no hablamos, español, que es el
 *  idioma de la operación. */
function idiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA)
    if (guardado && (IDIOMAS as readonly string[]).includes(guardado)) return guardado as Idioma
  } catch {
    /* Almacenamiento bloqueado: se decide por el navegador. */
  }

  const delNavegador = (navigator.language || '').slice(0, 2).toLowerCase()
  return delNavegador === 'en' ? 'en' : 'es'
}

void i18next.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: idiomaInicial(),
  fallbackLng: 'es',
  // Sin espacios de nombres ni claves anidadas por punto que choquen con los
  // nombres reales: las claves se leen tal cual están en el JSON.
  interpolation: { escapeValue: false },
})

/** El idioma vigente, en el formato que espera una cabecera HTTP. */
export function idiomaActual(): Idioma {
  const activo = (i18next.resolvedLanguage || i18next.language || 'es').slice(0, 2)
  return activo === 'en' ? 'en' : 'es'
}

export function cambiarIdioma(idioma: Idioma): void {
  void i18next.changeLanguage(idioma)
  document.documentElement.lang = idioma
  try {
    localStorage.setItem(CLAVE_IDIOMA, idioma)
  } catch {
    /* Sin almacenamiento el cambio vale solo para esta pestaña. */
  }
}

// El atributo del documento desde el arranque: de él dependen la lectura por
// voz, el corrector del navegador y la partición de palabras.
if (typeof document !== 'undefined') document.documentElement.lang = idiomaActual()

export default i18next
