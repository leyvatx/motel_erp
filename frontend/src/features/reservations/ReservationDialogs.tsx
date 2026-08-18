import { useEffect, useMemo, useState } from 'react'

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
  useCreateReservation,
  useCheckInReservation,
  useRoomGrid,
  useRoomTypes,
  useTariffBlocks,
} from '@/features/frontdesk/hooks'
import type { Reservation } from '@/features/frontdesk/types'
import { formatMoney } from '@/lib/format'

function localDateTime(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function ReservationFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const roomTypes = useRoomTypes()
  const rooms = useRoomGrid()
  const create = useCreateReservation()
  const [roomType, setRoomType] = useState('')
  const [room, setRoom] = useState('none')
  const [tariff, setTariff] = useState('none')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [guest, setGuest] = useState('')
  const [phone, setPhone] = useState('')
  const [plate, setPlate] = useState('')
  const [occupants, setOccupants] = useState('2')
  const [deposit, setDeposit] = useState('0')
  const [notes, setNotes] = useState('')
  const tariffs = useTariffBlocks(roomType ? Number(roomType) : undefined)

  useEffect(() => {
    if (!open) return
    const arrival = new Date(Date.now() + 60 * 60_000)
    const departure = new Date(arrival.getTime() + 4 * 60 * 60_000)
    setStart(localDateTime(arrival))
    setEnd(localDateTime(departure))
    setRoomType('')
    setRoom('none')
    setTariff('none')
    setGuest('')
    setPhone('')
    setPlate('')
    setOccupants('2')
    setDeposit('0')
    setNotes('')
  }, [open])

  const matchingRooms = (rooms.data?.results ?? []).filter(
    (item) => item.room_type === Number(roomType),
  )
  const selectedTariff = tariffs.data?.results.find((item) => item.id === Number(tariff))
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!roomType || !start || !end) return
    create.mutate(
      {
        room_type_id: Number(roomType),
        room_id: room === 'none' ? null : Number(room),
        tariff_block_id: tariff === 'none' ? null : Number(tariff),
        scheduled_start: new Date(start).toISOString(),
        scheduled_end: new Date(end).toISOString(),
        guest_name: guest,
        guest_phone: phone,
        vehicle_plate: plate.toUpperCase(),
        occupants: Number(occupants),
        deposit_amount: deposit || '0',
        notes,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva reservación</DialogTitle>
          <DialogDescription>
            La habitación puede asignarse ahora o al registrar la llegada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo de habitación</Label>
              <Select
                value={roomType}
                onValueChange={(value) => {
                  setRoomType(value)
                  setRoom('none')
                  setTariff('none')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {(roomTypes.data?.results ?? []).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Habitación</Label>
              <Select value={room} onValueChange={setRoom} disabled={!roomType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Asignar después</SelectItem>
                  {matchingRooms.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      Hab. {item.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tarifa</Label>
              <Select value={tariff} onValueChange={setTariff} disabled={!roomType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cotizar después</SelectItem>
                  {(tariffs.data?.results ?? []).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name} · {formatMoney(item.current_price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reservation-start">Llegada</Label>
              <Input
                id="reservation-start"
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservation-end">Salida estimada</Label>
              <Input
                id="reservation-end"
                type="datetime-local"
                value={end}
                min={start}
                onChange={(event) => setEnd(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reservation-guest">Huésped</Label>
              <Input
                id="reservation-guest"
                value={guest}
                onChange={(event) => setGuest(event.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservation-phone">Teléfono</Label>
              <Input
                id="reservation-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={20}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="reservation-plate">Placas</Label>
              <Input
                id="reservation-plate"
                className="uppercase"
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
                maxLength={15}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservation-occupants">Ocupantes</Label>
              <Input
                id="reservation-occupants"
                type="number"
                min={1}
                max={20}
                value={occupants}
                onChange={(event) => setOccupants(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservation-deposit">Anticipo</Label>
              <Input
                id="reservation-deposit"
                type="number"
                min={0}
                step="0.01"
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reservation-notes">Notas</Label>
            <Input
              id="reservation-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
            />
          </div>
          {selectedTariff ? (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              Precio previsto: <strong>{formatMoney(selectedTariff.current_price)}</strong>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!roomType || !start || !end}>
              Guardar reservación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ReservationCheckInDialog({
  reservation,
  open,
  onOpenChange,
}: {
  reservation: Reservation | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rooms = useRoomGrid()
  const tariffs = useTariffBlocks(reservation?.room_type)
  const checkIn = useCheckInReservation()
  const [room, setRoom] = useState('')
  const [tariff, setTariff] = useState('')
  useEffect(() => {
    if (open) {
      setRoom(reservation?.room ? String(reservation.room) : '')
      setTariff(reservation?.tariff_block ? String(reservation.tariff_block) : '')
    }
  }, [open, reservation])
  const roomOptions = useMemo(
    () =>
      (rooms.data?.results ?? []).filter(
        (item) =>
          item.room_type === reservation?.room_type &&
          ['AVAILABLE', 'RESERVED'].includes(item.status),
      ),
    [reservation, rooms.data],
  )
  if (!reservation) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar llegada</DialogTitle>
          <DialogDescription>
            {reservation.code} · {reservation.guest_name || 'Huésped sin nombre'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Habitación</Label>
            <Select value={room} onValueChange={setRoom}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona habitación" />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    Hab. {item.number} · {item.status_display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bloque tarifario</Label>
            <Select value={tariff} onValueChange={setTariff}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tarifa" />
              </SelectTrigger>
              <SelectContent>
                {(tariffs.data?.results ?? []).map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name} · {formatMoney(item.current_price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!room || !tariff}
            loading={checkIn.isPending}
            onClick={() =>
              checkIn.mutate(
                { id: reservation.id, roomId: Number(room), tariffBlockId: Number(tariff) },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            Iniciar renta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
