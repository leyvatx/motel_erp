import { useState } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import { useReportMaintenance } from '@/features/housekeeping/hooks'
import type { MaintenancePriority } from '@/features/housekeeping/types'
import { frontdeskApi } from '@/features/frontdesk/api'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryClient'

const CATEGORIES = [
  { value: 'PLUMBING', label: 'Plomería' },
  { value: 'ELECTRICAL', label: 'Electricidad' },
  { value: 'AIR_CONDITIONING', label: 'Clima' },
  { value: 'FURNITURE', label: 'Mobiliario' },
  { value: 'ELECTRONICS', label: 'Televisión / electrónicos' },
  { value: 'STRUCTURE', label: 'Obra civil' },
  { value: 'OTHER', label: 'Otro' },
] as const

const PRIORITIES: { value: MaintenancePriority; label: string }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultRoomId?: number | null
}

export function ReportMaintenanceDialog({ open, onOpenChange, defaultRoomId }: Props) {
  const report = useReportMaintenance()
  const { data: rooms } = useQuery({
    queryKey: queryKeys.frontdesk.rooms({ page_size: 200 }),
    queryFn: () => frontdeskApi.rooms({ page_size: 200 }),
    enabled: open,
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [roomId, setRoomId] = useState(defaultRoomId ? String(defaultRoomId) : '')
  const [category, setCategory] = useState<string>('OTHER')
  const [priority, setPriority] = useState<MaintenancePriority>('MEDIUM')
  const [blocksRoom, setBlocksRoom] = useState(false)

  const isValid = title.trim().length >= 5 && description.trim().length >= 5

  const submit = (): void => {
    report.mutate(
      {
        title,
        description,
        room_id: roomId ? Number(roomId) : null,
        category,
        priority,
        blocks_room: blocksRoom,
      },
      {
        onSuccess: () => {
          setTitle('')
          setDescription('')
          setBlocksRoom(false)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar mantenimiento</DialogTitle>
          <DialogDescription>
            El reporte queda con seguimiento hasta que alguien lo cierre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Fuga de agua en regadera"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Gotea constante y moja el piso del bano."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="room">Habitación</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger id="room">
                  <SelectValue placeholder="Área común" />
                </SelectTrigger>
                <SelectContent>
                  {(rooms?.results ?? []).map((room) => (
                    <SelectItem key={room.id} value={String(room.id)}>
                      Habitación {room.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridad</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as MaintenancePriority)}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-2 rounded-md bg-accent/50 p-3 text-sm">
            <input
              type="checkbox"
              checked={blocksRoom}
              onChange={(event) => setBlocksRoom(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span>
              Dejar la habitación fuera de servicio
              <span className="block text-xs text-muted-foreground">
                No se podrá rentar hasta que el reporte se cierre.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!isValid} loading={report.isPending} onClick={submit}>
            Reportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
