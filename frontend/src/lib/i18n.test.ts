import { describe, expect, it } from 'vitest'

import en from '@/locales/en.json'
import es from '@/locales/es.json'

/** Todas las rutas de claves de un objeto de traducción, en plano. */
function claves(objeto: Record<string, unknown>, prefijo = ''): string[] {
  return Object.entries(objeto).flatMap(([clave, valor]) =>
    typeof valor === 'object' && valor !== null
      ? claves(valor as Record<string, unknown>, `${prefijo}${clave}.`)
      : [`${prefijo}${clave}`],
  )
}

describe('catálogos de traducción', () => {
  // Una clave que existe en un idioma y no en el otro no revienta: sale el
  // texto en español dentro de una pantalla en inglés, que es peor porque nadie
  // lo reporta como error.
  it('los dos idiomas tienen exactamente las mismas claves', () => {
    expect(claves(en).sort()).toEqual(claves(es).sort())
  })

  it('ninguna traducción quedó vacía', () => {
    for (const catalogo of [es, en]) {
      const plano = JSON.stringify(catalogo)
      expect(plano).not.toContain('""')
    }
  })

  // Marca blanca: el producto se vende a hospedaje en general y la portada
  // pública es lo primero que ve alguien de fuera. En inglés se nombra la
  // categoría, no el tipo de establecimiento.
  it('la portada en inglés no dice de qué clase de negocio se trata', () => {
    expect(JSON.stringify(en).toLowerCase()).not.toContain('motel')
  })

  it('la portada en inglés usa los términos neutros de la industria', () => {
    const plano = JSON.stringify(en).toLowerCase()
    expect(plano).toContain('hospitality management')
    expect(plano).toContain('room control')
    expect(plano).toContain('property management system')
  })
})
