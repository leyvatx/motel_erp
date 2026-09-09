import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PiMagnifyingGlass } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MINIMO_CARACTERES, useGlobalSearch } from '@/features/search/hooks'
import type { SearchHit } from '@/features/search/types'
import { cn } from '@/lib/utils'

interface Props {
  onSelectStay: (stayId: number) => void
}

export function GlobalSearch({ onSelectStay }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [focused, setFocused] = useState(false)
  const [activo, setActivo] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [term])

  const { data, isFetching } = useGlobalSearch(debounced)
  const grupos = useMemo(() => data ?? [], [data])
  const planos = useMemo(() => grupos.flatMap((grupo) => grupo.hits), [grupos])

  useEffect(() => setActivo(0), [debounced])

  const cerrar = (): void => {
    setTerm('')
    setDebounced('')
    inputRef.current?.blur()
  }

  const elegir = (hit: SearchHit): void => {
    if (hit.stayId !== undefined) {
      onSelectStay(hit.stayId)
    } else if (hit.kind === 'room' && hit.roomNumber) {
      navigate(`/frontdesk?habitacion=${encodeURIComponent(hit.roomNumber)}`)
    } else if ((hit.kind === 'reservation' || hit.kind === 'guest') && hit.query) {
      navigate(`/reservations?buscar=${encodeURIComponent(hit.query)}`)
    } else if (hit.kind === 'folio') {
      navigate('/finances')
    }
    cerrar()
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const mostrarPanel = focused && debounced.length >= MINIMO_CARACTERES

  const enTeclado = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!mostrarPanel || planos.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActivo((indice) => (indice + 1) % planos.length)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActivo((indice) => (indice - 1 + planos.length) % planos.length)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const hit = planos[activo]
      if (hit) elegir(hit)
    }
  }

  let indiceGlobal = -1

  return (
    <div className="relative w-full max-w-sm">
      <PiMagnifyingGlass
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        onKeyDown={enTeclado}
        placeholder={t('comun.buscarGlobal')}
        className="bg-muted/50 pl-8 pr-14 shadow-none"
        aria-label={t('comun.buscadorGlobal')}
        role="combobox"
        aria-expanded={mostrarPanel}
        aria-controls="resultados-busqueda"
      />
      <kbd
        className={cn(
          'pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-0.5',
          'rounded border bg-background px-1.5 font-mono text-2xs text-muted-foreground sm:flex',
        )}
      >
        Ctrl K
      </kbd>

      {mostrarPanel ? (
        <div
          id="resultados-busqueda"
          role="listbox"
          className="absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-y-auto scrollbar-thin rounded-lg border bg-popover shadow-md"
        >
          {planos.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isFetching ? 'Buscando...' : t('comun.sinCoincidencias')}
            </p>
          ) : (
            <div className="p-1">
              {grupos.map((grupo) => (
                <div key={grupo.kind} className="pb-1 last:pb-0">
                  <p className="px-2.5 pb-1 pt-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                    {grupo.label}
                  </p>
                  <ul>
                    {grupo.hits.map((hit) => {
                      indiceGlobal += 1
                      const indice = indiceGlobal
                      return (
                        <li key={hit.key}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={indice === activo}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActivo(indice)}
                            onClick={() => elegir(hit)}
                            className={cn(
                              'flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                              indice === activo ? 'bg-accent' : 'hover:bg-accent/60',
                            )}
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">{hit.title}</span>
                              {hit.subtitle ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {hit.subtitle}
                                </span>
                              ) : null}
                            </span>
                            {hit.badge ? (
                              <Badge variant="secondary" className="shrink-0 text-2xs">
                                {hit.badge}
                              </Badge>
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
