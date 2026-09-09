import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePlatformMotels } from '@/features/platform/hooks'
import { formatDate } from '@/lib/format'

export default function PlatformPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const motels = usePlatformMotels({
    page,
    page_size: pageSize,
    search: search || undefined,
    ordering: 'name',
  })

  return (
    <PageShell
      title="Sucursales"
      description={t('plataforma.subtitulo')}
      toolbar={
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder={t('plataforma.buscarSucursal')}
          className="max-w-md"
          aria-label="Buscar sucursales"
        />
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sucursal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Usuarios</TableHead>
                <TableHead>Habitaciones</TableHead>
                <TableHead>Zona horaria</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {motels.isLoading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : motels.data?.results.length ? (
                motels.data.results.map((motel) => (
                  <TableRow key={motel.id}>
                    <TableCell>
                      <div className="font-medium">{motel.name}</div>
                      <div className="text-xs text-muted-foreground">{motel.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={motel.is_active ? 'available' : 'secondary'}>
                        {motel.is_active ? 'Activo' : 'Suspendido'}
                      </Badge>
                    </TableCell>
                    <TableCell>{motel.user_count}</TableCell>
                    <TableCell>{motel.room_count}</TableCell>
                    <TableCell>{motel.time_zone}</TableCell>
                    <TableCell>{formatDate(motel.created_at)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={6} message={t('plataforma.sinSucursales')} />
              )}
            </TableBody>
          </Table>
        </TableScroll>

        {motels.data ? (
          <Pagination
            page={motels.data.page}
            pageSize={motels.data.page_size}
            count={motels.data.count}
            totalPages={motels.data.total_pages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            isFetching={motels.isFetching}
          />
        ) : null}
      </Card>
    </PageShell>
  )
}
