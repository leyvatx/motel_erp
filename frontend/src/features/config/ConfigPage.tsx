import { useState } from 'react'
import { PiPencilSimple, PiPlus, PiProhibit } from 'react-icons/pi'

import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { AppearanceSettings } from '@/features/config/components/AppearanceSettings'
import { DynamicPricingSettings } from '@/features/config/components/DynamicPricingSettings'
import { BusinessSettings } from '@/features/config/components/BusinessSettings'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RowActions, useRowContextMenu, type RowAction } from '@/components/ui/row-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  RoomFormDialog,
  RoomTypeFormDialog,
  TariffFormDialog,
} from '@/features/config/components/ConfigDialogs'
import {
  useAllRooms,
  useAllTariffBlocks,
  useDeactivateRoom,
  useDeactivateRoomType,
  useDeactivateTariff,
} from '@/features/config/hooks'
import { useRoomTypes } from '@/features/frontdesk/hooks'
import type { Room, RoomType, TariffBlock } from '@/features/frontdesk/types'
import { formatMoney } from '@/lib/format'

export default function ConfigPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const rooms = useAllRooms(page, pageSize)
  const roomTypes = useRoomTypes()
  const tariffs = useAllTariffBlocks()

  const [roomForm, setRoomForm] = useState<{ open: boolean; room: Room | null }>({
    open: false,
    room: null,
  })
  const [typeForm, setTypeForm] = useState<{ open: boolean; item: RoomType | null }>({
    open: false,
    item: null,
  })
  const [tariffForm, setTariffForm] = useState<{ open: boolean; item: TariffBlock | null }>({
    open: false,
    item: null,
  })

  const deactivateRoom = useDeactivateRoom()
  const deactivateType = useDeactivateRoomType()
  const deactivateTariff = useDeactivateTariff()
  const openContextMenu = useRowContextMenu()

  const roomActions = (room: Room): RowAction[] => [
    {
      key: 'edit',
      label: 'Editar',
      icon: <PiPencilSimple />,
      onSelect: () => setRoomForm({ open: true, room }),
    },
    {
      key: 'deactivate',
      label: 'Dar de baja',
      icon: <PiProhibit />,
      danger: true,
      separated: true,
      disabled: !room.is_active,
      onSelect: () => deactivateRoom.mutate(room.id),
    },
  ]

  const typeActions = (item: RoomType): RowAction[] => [
    {
      key: 'edit',
      label: 'Editar',
      icon: <PiPencilSimple />,
      onSelect: () => setTypeForm({ open: true, item }),
    },
    {
      key: 'tariff',
      label: 'Nueva tarifa para este tipo',
      icon: <PiPlus />,
      onSelect: () => setTariffForm({ open: true, item: null }),
    },
    {
      key: 'deactivate',
      label: 'Dar de baja',
      icon: <PiProhibit />,
      danger: true,
      separated: true,
      disabled: !item.is_active,
      onSelect: () => deactivateType.mutate(item.id),
    },
  ]

  const tariffActions = (item: TariffBlock): RowAction[] => [
    {
      key: 'edit',
      label: 'Editar',
      icon: <PiPencilSimple />,
      onSelect: () => setTariffForm({ open: true, item }),
    },
    {
      key: 'deactivate',
      label: 'Dar de baja',
      icon: <PiProhibit />,
      danger: true,
      separated: true,
      disabled: !item.is_active,
      onSelect: () => deactivateTariff.mutate(item.id),
    },
  ]

  return (
    <PageShell
      title="Configuración"
      description="Datos del negocio, habitaciones, tarifas y apariencia."
    >
      <Tabs defaultValue="business" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="business">Negocio</TabsTrigger>
          <TabsTrigger value="rooms">Habitaciones</TabsTrigger>
          <TabsTrigger value="types">Tipos</TabsTrigger>
          <TabsTrigger value="tariffs">Tarifas</TabsTrigger>
          <TabsTrigger value="dynamic-pricing">Precios especiales</TabsTrigger>
          <TabsTrigger value="appearance">Apariencia</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          <BusinessSettings />
        </TabsContent>

        <TabsContent value="rooms" className="flex min-h-0 flex-1 flex-col">
          <Card className="min-h-0 flex-1">
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Habitaciones</CardTitle>
                <CardDescription>
                  Clic derecho sobre una fila para ver sus acciones.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setRoomForm({ open: true, room: null })}>
                <PiPlus />
                Nueva habitación
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <TableScroll>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Piso / zona</TableHead>
                      <TableHead>Cochera</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rooms.data?.results ?? []).length === 0 ? (
                      <TableEmpty colSpan={6} message="Aún no hay habitaciones dadas de alta." />
                    ) : (
                      (rooms.data?.results ?? []).map((room) => (
                        <TableRow
                          key={room.id}
                          onContextMenu={openContextMenu(
                            `Habitación ${room.number}`,
                            roomActions(room),
                          )}
                          className="cursor-context-menu"
                        >
                          <TableCell className="font-medium tabular">{room.number}</TableCell>
                          <TableCell>{room.room_type_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            Piso {room.floor}
                            {room.zone ? ` · ${room.zone}` : ''}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {room.has_garage ? 'Sí' : 'No'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={room.is_active ? 'available' : 'secondary'}>
                              {room.is_active ? room.status_display : 'Dada de baja'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <RowActions
                              items={roomActions(room)}
                              label={`habitación ${room.number}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableScroll>

              <Pagination
                page={rooms.data?.page ?? 1}
                pageSize={pageSize}
                count={rooms.data?.count ?? 0}
                totalPages={rooms.data?.total_pages ?? 1}
                isFetching={rooms.isFetching}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="flex min-h-0 flex-1 flex-col">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Tipos de habitación</CardTitle>
                <CardDescription>Definen capacidad y cargo por persona extra.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setTypeForm({ open: true, item: null })}>
                <PiPlus />
                Nuevo tipo
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <TableScroll>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Clave</TableHead>
                      <TableHead className="text-right">Ocupantes</TableHead>
                      <TableHead className="text-right">Persona extra</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(roomTypes.data?.results ?? []).length === 0 ? (
                      <TableEmpty colSpan={5} message="Sin tipos registrados." />
                    ) : (
                      (roomTypes.data?.results ?? []).map((item) => (
                        <TableRow
                          key={item.id}
                          onContextMenu={openContextMenu(item.name, typeActions(item))}
                          className="cursor-context-menu"
                        >
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="font-mono text-xs">{item.code}</TableCell>
                          <TableCell className="text-right tabular">{item.max_occupants}</TableCell>
                          <TableCell className="text-right tabular">
                            {formatMoney(item.extra_person_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <RowActions items={typeActions(item)} label={item.name} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableScroll>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tariffs" className="flex min-h-0 flex-1 flex-col">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Bloques tarifarios</CardTitle>
                <CardDescription>
                  Duración, precio y recargo por hora excedida de cada bloque.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setTariffForm({ open: true, item: null })}>
                <PiPlus />
                Nueva tarifa
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <TableScroll>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Bloque</TableHead>
                      <TableHead className="text-right">Duración</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Hora extra</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tariffs.data?.results ?? []).length === 0 ? (
                      <TableEmpty colSpan={6} message="Sin tarifas registradas." />
                    ) : (
                      (tariffs.data?.results ?? []).map((item) => (
                        <TableRow
                          key={item.id}
                          onContextMenu={openContextMenu(item.name, tariffActions(item))}
                          className="cursor-context-menu"
                        >
                          <TableCell className="text-muted-foreground">
                            {item.room_type_name}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.is_default ? (
                              <Badge variant="outline" className="ml-2">
                                Sugerido
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular">
                            {item.duration_minutes / 60} h
                          </TableCell>
                          <TableCell className="text-right tabular font-medium">
                            {formatMoney(item.base_price)}
                          </TableCell>
                          <TableCell className="text-right tabular text-muted-foreground">
                            {formatMoney(item.overstay_hour_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <RowActions items={tariffActions(item)} label={item.name} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableScroll>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent
          value="dynamic-pricing"
          className="min-h-0 flex-1 overflow-auto scrollbar-thin"
        >
          <DynamicPricingSettings />
        </TabsContent>
      </Tabs>

      <RoomFormDialog
        open={roomForm.open}
        room={roomForm.room}
        onOpenChange={(open) => setRoomForm({ open, room: open ? roomForm.room : null })}
      />
      <RoomTypeFormDialog
        open={typeForm.open}
        item={typeForm.item}
        onOpenChange={(open) => setTypeForm({ open, item: open ? typeForm.item : null })}
      />
      <TariffFormDialog
        open={tariffForm.open}
        item={tariffForm.item}
        onOpenChange={(open) => setTariffForm({ open, item: open ? tariffForm.item : null })}
      />
    </PageShell>
  )
}
