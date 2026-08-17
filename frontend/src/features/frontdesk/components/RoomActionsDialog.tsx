import { useState } from 'react'
import { BedDouble, Sparkles, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFinishCleaning, useSetOutOfService } from '@/features/frontdesk/hooks'
import type { RoomGridItem } from '@/features/frontdesk/types'

interface Props {
  room: RoomGridItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRent: (room: RoomGridItem) => void
}

export function RoomActionsDialog({ room, open, onOpenChange, onRent }: Props) {
  const finishCleaning = useFinishCleaning()
  const outOfService = useSetOutOfService()
  const [reason, setReason] = useState('')
  const [showReason, setShowReason] = useState(false)

  if (!room) return null

  const close = (): void => {
    setReason('')
    setShowReason(false)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
        else onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Habitación {room.number}</DialogTitle>
          <DialogDescription>
            {room.room_type_name} - {room.status_display}
          </DialogDescription>
        </DialogHeader>

        {room.out_of_service_reason ? (
          <p className="rounded-md bg-status-maintenance/10 px-3 py-2 text-sm text-muted-foreground">
            {room.out_of_service_reason}
          </p>
        ) : null}

        <div className="space-y-2">
          {room.status === 'AVAILABLE' || room.status === 'RESERVED' ? (
            <Button className="w-full justify-start" onClick={() => onRent(room)}>
              <BedDouble className="h-4 w-4" />
              Rentar
            </Button>
          ) : null}

          {room.status === 'CLEANING' ? (
            <Button
              variant="success"
              className="w-full justify-start"
              loading={finishCleaning.isPending}
              onClick={() => finishCleaning.mutate(room.id, { onSuccess: close })}
            >
              <Sparkles className="h-4 w-4" />
              Marcar limpieza terminada
            </Button>
          ) : null}

          {room.status !== 'MAINTENANCE' && room.status !== 'OCCUPIED' ? (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowReason(true)}
            >
              <Wrench className="h-4 w-4" />
              Enviar a mantenimiento
            </Button>
          ) : null}
        </div>

        {showReason ? (
          <div className="space-y-3 rounded-md border p-4">
            <Label htmlFor="oos-reason">Motivo</Label>
            <Input
              id="oos-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Fuga en la regadera"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReason(false)}>
                Volver
              </Button>
              <Button
                variant="warning"
                disabled={reason.trim().length < 5}
                loading={outOfService.isPending}
                onClick={() =>
                  outOfService.mutate({ roomId: room.id, reason }, { onSuccess: close })
                }
              >
                Confirmar
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
