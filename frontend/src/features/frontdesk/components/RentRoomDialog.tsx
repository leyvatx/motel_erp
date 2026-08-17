import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRentRoom, useTariffBlocks } from '@/features/frontdesk/hooks'
import type { RoomGridItem } from '@/features/frontdesk/types'
import { formatMoney } from '@/lib/format'

const rentSchema = z.object({
  tariff_block_id: z.coerce.number().int().positive('Elige el bloque de tiempo.'),
  occupants: z.coerce.number().int().min(1).max(20),
  guest_name: z.string().max(120).optional(),
  vehicle_plate: z.string().max(15).optional(),
  vehicle_description: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
})

type RentForm = z.input<typeof rentSchema>

interface Props {
  room: RoomGridItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Alta de renta.
 *
 * El precio y la hora de vencimiento los fija el servidor: aquí solo se
 * muestra la tarifa vigente como referencia para el huesped.
 */
export function RentRoomDialog({ room, open, onOpenChange }: Props) {
  const { data: blocks, isLoading } = useTariffBlocks(room?.room_type)
  const rent = useRentRoom()

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<RentForm>({
    resolver: zodResolver(rentSchema),
    defaultValues: { occupants: 2 },
  })

  useEffect(() => {
    if (open) reset({ occupants: 2 })
  }, [open, reset])

  const options = useMemo(
    () => (blocks?.results ?? []).filter((block) => block.is_active),
    [blocks],
  )
  const selectedId = Number(watch('tariff_block_id'))
  const selected = options.find((block) => block.id === selectedId)

  if (!room) return null

  const onSubmit = handleSubmit((values) => {
    rent.mutate(
      {
        room_id: room.id,
        tariff_block_id: Number(values.tariff_block_id),
        occupants: Number(values.occupants),
        guest_name: values.guest_name ?? '',
        vehicle_plate: (values.vehicle_plate ?? '').toUpperCase(),
        vehicle_description: values.vehicle_description ?? '',
        notes: values.notes ?? '',
      },
      { onSuccess: () => onOpenChange(false) },
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rentar habitación {room.number}</DialogTitle>
          <DialogDescription>
            {room.room_type_name} - el cronómetro arranca al confirmar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="tariff">Bloque de tiempo</Label>
            <Controller
              control={control}
              name="tariff_block_id"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                >
                  <SelectTrigger id="tariff">
                    <SelectValue placeholder={isLoading ? 'Cargando...' : 'Elige el bloque'} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((block) => (
                      <SelectItem key={block.id} value={String(block.id)}>
                        {block.name} - {formatMoney(block.current_price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.tariff_block_id ? (
              <p className="text-xs text-status-occupied">{errors.tariff_block_id.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="occupants">Ocupantes</Label>
              <Input id="occupants" type="number" min={1} max={20} {...register('occupants')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate">Placas</Label>
              <Input id="plate" className="uppercase" placeholder="ABC-123" {...register('vehicle_plate')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="guest">Nombre (opcional)</Label>
              <Input id="guest" {...register('guest_name')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehículo (opcional)</Label>
              <Input id="vehicle" placeholder="Sedan gris" {...register('vehicle_description')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" {...register('notes')} />
          </div>

          {selected ? (
            <div className="rounded-md bg-accent/60 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tarifa vigente</span>
                <span className="font-semibold tabular">{formatMoney(selected.current_price)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Duración</span>
                <span className="tabular">{selected.duration_minutes / 60} h</span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={rent.isPending}>
              Rentar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
