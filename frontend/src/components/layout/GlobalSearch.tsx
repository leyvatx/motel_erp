import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { frontdeskApi } from '@/features/frontdesk/api'
import { formatCountdown } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import { secondsUntil } from '@/lib/serverTime'
import { cn } from '@/lib/utils'

interface Props {
  onSelectStay: (stayId: number) => void
}

export function GlobalSearch({ onSelectStay }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [term])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'Escape') inputRef.current?.blur()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.frontdesk.stays({ search: debounced }),
    queryFn: () => frontdeskApi.stays({ search: debounced, status: 'ACTIVE', page_size: 8 }),
    enabled: debounced.length >= 2,
  })

  const results = data?.results ?? []
  const showPanel = focused && debounced.length >= 2

  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar placas, cuarto o folio..."
        className="bg-muted/50 pl-8 pr-14 shadow-none"
        aria-label="Buscador global"
      />
      <kbd
        className={cn(
          'pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-0.5',
          'rounded border bg-background px-1.5 font-mono text-2xs text-muted-foreground sm:flex',
        )}
      >
        Ctrl K
      </kbd>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border bg-popover shadow-md">
          {isFetching ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Sin coincidencias activas.
            </p>
          ) : (
            <ul className="p-1">
              {results.map((stay) => (
                <li key={stay.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelectStay(stay.id)
                      setTerm('')
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-medium">Hab. {stay.room_number}</span>
                      {stay.vehicle_plate ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {stay.vehicle_plate}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">
                      {formatCountdown(secondsUntil(stay.expires_at))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
