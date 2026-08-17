import { useEffect, useState, type ReactNode } from 'react'

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
import {
  useCreateRoom,
  useCreateRoomType,
  useCreateTariff,
  useUpdateRoom,
  useUpdateRoomType,
  useUpdateTariff,
} from '@/features/config/hooks'
import { useRoomTypes } from '@/features/frontdesk/hooks'
import type { Room, RoomType, TariffBlock } from '@/features/frontdesk/types'

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function Shell({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting,
  valid,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onSubmit: () => void
  submitting: boolean
  valid: boolean
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">{children}</div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!valid} loading={submitting} onClick={onSubmit}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RoomFormDialog({
  open,
  room,
  onOpenChange,
}: {
  open: boolean
  room: Room | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: types } = useRoomTypes()
  const create = useCreateRoom()
  const update = useUpdateRoom()

  const [number, setNumber] = useState('')
  const [roomType, setRoomType] = useState('')
  const [floor, setFloor] = useState('1')
  const [zone, setZone] = useState('')
  const [garage, setGarage] = useState(true)

  useEffect(() => {
    if (!open) return
    setNumber(room?.number ?? '')
    setRoomType(room ? String(room.room_type) : '')
    setFloor(String(room?.floor ?? 1))
    setZone(room?.zone ?? '')
    setGarage(room?.has_garage ?? true)
  }, [open, room])

  const valid = number.trim().length > 0 && roomType !== ''

  const submit = (): void => {
    const payload = {
      number: number.trim(),
      room_type: Number(roomType),
      floor: Number(floor) || 1,
      zone: zone.trim(),
      has_garage: garage,
    }
    const done = { onSuccess: () => onOpenChange(false) }
    if (room) update.mutate({ id: room.id, payload }, done)
    else create.mutate(payload, done)
  }

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={room ? `Editar habitación ${room.number}` : 'Nueva habitación'}
      description="El número debe ser único entre las habitaciones vigentes."
      onSubmit={submit}
      submitting={create.isPending || update.isPending}
      valid={valid}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Número" htmlFor="room-number">
          <Input
            id="room-number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="101"
          />
        </Field>
        <Field label="Piso" htmlFor="room-floor">
          <Input
            id="room-floor"
            type="number"
            min={1}
            value={floor}
            onChange={(event) => setFloor(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Tipo" htmlFor="room-type">
        <Select value={roomType} onValueChange={setRoomType}>
          <SelectTrigger id="room-type">
            <SelectValue placeholder="Elige el tipo" />
          </SelectTrigger>
          <SelectContent>
            {(types?.results ?? []).map((type) => (
              <SelectItem key={type.id} value={String(type.id)}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Zona o edificio" htmlFor="room-zone">
        <Input
          id="room-zone"
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          placeholder="Edificio A"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={garage}
          onChange={(event) => setGarage(event.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        Tiene cochera privada
      </label>
    </Shell>
  )
}

export function RoomTypeFormDialog({
  open,
  item,
  onOpenChange,
}: {
  open: boolean
  item: RoomType | null
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateRoomType()
  const update = useUpdateRoomType()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [occupants, setOccupants] = useState('2')
  const [extra, setExtra] = useState('0.00')

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setCode(item?.code ?? '')
    setOccupants(String(item?.max_occupants ?? 2))
    setExtra(item?.extra_person_price ?? '0.00')
  }, [open, item])

  const valid = name.trim().length > 1 && code.trim().length > 1

  const submit = (): void => {
    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      max_occupants: Number(occupants) || 2,
      extra_person_price: extra || '0.00',
    }
    const done = { onSuccess: () => onOpenChange(false) }
    if (item) update.mutate({ id: item.id, payload }, done)
    else create.mutate(payload, done)
  }

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `Editar ${item.name}` : 'Nuevo tipo de habitación'}
      description="Agrupa habitaciones que comparten capacidad y tarifas."
      onSubmit={submit}
      submitting={create.isPending || update.isPending}
      valid={valid}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" htmlFor="type-name">
          <Input
            id="type-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jacuzzi"
          />
        </Field>
        <Field label="Clave" htmlFor="type-code">
          <Input
            id="type-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="JAC"
            className="uppercase"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ocupantes máximos" htmlFor="type-occupants">
          <Input
            id="type-occupants"
            type="number"
            min={1}
            value={occupants}
            onChange={(event) => setOccupants(event.target.value)}
          />
        </Field>
        <Field label="Cargo por persona extra" htmlFor="type-extra">
          <Input
            id="type-extra"
            inputMode="decimal"
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
          />
        </Field>
      </div>
    </Shell>
  )
}

export function TariffFormDialog({
  open,
  item,
  onOpenChange,
}: {
  open: boolean
  item: TariffBlock | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: types } = useRoomTypes()
  const create = useCreateTariff()
  const update = useUpdateTariff()

  const [roomType, setRoomType] = useState('')
  const [name, setName] = useState('')
  const [hours, setHours] = useState('4')
  const [price, setPrice] = useState('')
  const [overstay, setOverstay] = useState('0.00')
  const [grace, setGrace] = useState('15')
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    if (!open) return
    setRoomType(item ? String(item.room_type) : '')
    setName(item?.name ?? '')
    setHours(item ? String(item.duration_minutes / 60) : '4')
    setPrice(item?.base_price ?? '')
    setOverstay(item?.overstay_hour_price ?? '0.00')
    setGrace(String(item?.grace_minutes ?? 15))
    setIsDefault(item?.is_default ?? false)
  }, [open, item])

  const valid = roomType !== '' && name.trim().length > 0 && Number(hours) > 0 && price !== ''

  const submit = (): void => {
    const payload = {
      room_type: Number(roomType),
      name: name.trim(),
      duration_minutes: Math.round(Number(hours) * 60),
      base_price: price,
      overstay_hour_price: overstay || '0.00',
      grace_minutes: Number(grace) || 0,
      is_default: isDefault,
    }
    const done = { onSuccess: () => onOpenChange(false) }
    if (item) update.mutate({ id: item.id, payload }, done)
    else create.mutate(payload, done)
  }

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `Editar ${item.name}` : 'Nueva tarifa'}
      description="El precio base puede ajustarse por reglas de fin de semana o festivo."
      onSubmit={submit}
      submitting={create.isPending || update.isPending}
      valid={valid}
    >
      <Field label="Tipo de habitación" htmlFor="tariff-type">
        <Select value={roomType} onValueChange={setRoomType}>
          <SelectTrigger id="tariff-type">
            <SelectValue placeholder="Elige el tipo" />
          </SelectTrigger>
          <SelectContent>
            {(types?.results ?? []).map((type) => (
              <SelectItem key={type.id} value={String(type.id)}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre del bloque" htmlFor="tariff-name">
          <Input
            id="tariff-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="4 horas"
          />
        </Field>
        <Field label="Duración (horas)" htmlFor="tariff-hours">
          <Input
            id="tariff-hours"
            type="number"
            min={0.5}
            step={0.5}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Precio" htmlFor="tariff-price">
          <Input
            id="tariff-price"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="350.00"
          />
        </Field>
        <Field label="Hora extra" htmlFor="tariff-overstay">
          <Input
            id="tariff-overstay"
            inputMode="decimal"
            value={overstay}
            onChange={(event) => setOverstay(event.target.value)}
          />
        </Field>
        <Field label="Tolerancia (min)" htmlFor="tariff-grace">
          <Input
            id="tariff-grace"
            type="number"
            min={0}
            value={grace}
            onChange={(event) => setGrace(event.target.value)}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        Sugerir este bloque al rentar
      </label>
    </Shell>
  )
}
