import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  page: number
  pageSize: number
  count: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  isFetching?: boolean
}

const SIZES = [25, 50, 100]

/**
 * Paginación del lado del servidor.
 *
 * Vive pegada al pie de su tabla, no al final de la página: el usuario cambia
 * de página sin perder de vista el encabezado ni tener que bajar hasta abajo.
 */
export function Pagination({
  page,
  pageSize,
  count,
  totalPages,
  onPageChange,
  onPageSizeChange,
  isFetching,
}: Props) {
  if (count === 0) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, count)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
      <p className="text-xs text-muted-foreground tabular">
        {first}–{last} de {count} registros
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[5.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / pág.
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1 || isFetching}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="px-2 text-xs tabular text-muted-foreground">
            {page} / {Math.max(totalPages, 1)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages || isFetching}
            onClick={() => onPageChange(page + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
