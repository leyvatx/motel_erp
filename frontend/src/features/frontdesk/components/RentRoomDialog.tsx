import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { PiCaretDown } from 'react-icons/pi'
import { z } from 'zod'
import i18n from '@/lib/i18n'

import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'

const rentSchema = z.object({
  tariff_block_id: z.coerce.number().int().positive(i18n.t('recepcion.eligeElBloqueDeTiempo')),
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

export function RentRoomDialog({ room, open, onOpenChange }: Props) {
  const { data: blocks, isLoading } = useTariffBlocks(room?.room_type)
  const rent = useRentRoom()
  const [showOptional, setShowOptional] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RentForm>({
    resolver: zodResolver(rentSchema),
    defaultValues: { occupants: 2 },
  })

  useEffect(() => {
    if (open) {
      reset({ occupants: 2 })
      setShowOptional(false)
    }
  }, [open, reset])

  const options = useMemo(
    () => (blocks?.results ?? []).filter((block) => block.is_active),
    [blocks],
  )
  const sinTarifas = !isLoading && options.length === 0
  const selectedId = Number(watch('tariff_block_id'))
  const selected = options.find((block) => block.id === selectedId)

  useEffect(() => {
    if (!open || selectedId || options.length === 0) return
    const suggested = options.find((block) => block.is_default) ?? options[0]
    if (suggested) setValue('tariff_block_id', suggested.id, { shouldValidate: true })
  }, [open, options, selectedId, setValue])

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
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Rentar habitación ${room.number}`}
      description={`${room.room_type_name} - el cronómetro arranca al confirmar.`}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="tariff">{i18n.t('recepcion.bloqueDeTiempo')}</Label>
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
                  <SelectValue
                    placeholder={isLoading ? 'Cargando...' : i18n.t('recepcion.eligeElBloque')}
                  />
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

          {/* Un tipo de habitación sin tarifas es un hueco de configuración, no
              un error de quien está en el mostrador. Antes el desplegable
              quedaba vacío, el botón seguía activo, y al confirmar el servidor
              contestaba que "el bloque tarifario no corresponde al tipo de esta
              habitación" -- sobre un bloque que nadie había elegido. */}
          {sinTarifas ? (
            <p className="rounded-md border border-status-cleaning/40 bg-status-cleaning/5 px-3 py-2 text-xs leading-relaxed">
              Este tipo de habitación ({room.room_type_name}) todavía no tiene tarifas. Pídele a
              gerencia que las dé de alta en Configuración · Tarifas; mientras tanto no se puede
              rentar.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="occupants">{i18n.t('recepcion.ocupantes')}</Label>
            <Input id="occupants" type="number" min={1} max={20} {...register('occupants')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plate">{i18n.t('recepcion.placas')}</Label>
            <Input
              id="plate"
              className="uppercase"
              placeholder={i18n.t('recepcion.ejemploPlacas')}
              {...register('vehicle_plate')}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowOptional((value) => !value)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={showOptional}
        >
          <PiCaretDown
            className={cn('h-3.5 w-3.5 transition-transform', showOptional && 'rotate-180')}
            aria-hidden
          />
          {i18n.t('recepcion.datosDelHuesped')}
        </button>

        {showOptional ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="guest">{i18n.t('recepcion.nombre')}</Label>
                <Input id="guest" {...register('guest_name')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle">{i18n.t('recepcion.vehiculo')}</Label>
                <Input
                  id="vehicle"
                  placeholder={i18n.t('recepcion.ejemploVehiculo')}
                  {...register('vehicle_description')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{i18n.t('recepcion.notas')}</Label>
              <Input id="notes" {...register('notes')} />
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="rounded-md bg-accent/60 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{i18n.t('recepcion.tarifaVigente')}</span>
              <span className="font-semibold tabular">{formatMoney(selected.current_price)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{i18n.t('recepcion.duracion')}</span>
              <span className="tabular">{selected.duration_minutes / 60} h</span>
            </div>
          </div>
        ) : null}

        {/* En el teléfono la hoja llega hasta el borde, así que los botones
              van apilados y a lo ancho: es donde cae el pulgar. */}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => onOpenChange(false)}
          >
            {i18n.t('recepcion.cancelar')}
          </Button>
          <Button
            type="submit"
            className="h-11 sm:h-9"
            disabled={sinTarifas}
            loading={rent.isPending}
          >
            {i18n.t('recepcion.rentar')}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
