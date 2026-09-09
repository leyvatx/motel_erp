import { useState } from 'react'
import { PiBed, PiSignIn, PiSparkle, PiWrench } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useFinishCleaning,
  useRoomReservation,
  useSetOutOfService,
} from '@/features/frontdesk/hooks'
import type { RoomGridItem } from '@/features/frontdesk/types'
import { ReservationCheckInDialog } from '@/features/reservations/ReservationDialogs'
import { formatDateTime } from '@/lib/format'

interface Props {
  room: RoomGridItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRent: (room: RoomGridItem) => void
}

export function RoomActionsDialog({ room, open, onOpenChange, onRent }: Props) {
  const { t } = useTranslation()
  const finishCleaning = useFinishCleaning()
  const outOfService = useSetOutOfService()
  const { data: reservation } = useRoomReservation(open && room ? room.id : null)
  const [reason, setReason] = useState('')
  const [showReason, setShowReason] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  if (!room) return null

  const close = (): void => {
    setReason('')
    setShowReason(false)
    onOpenChange(false)
  }

  const rentable = room.status === 'AVAILABLE' || room.status === 'RESERVED'

  return (
    <>
      <ResponsiveDialog
        open={open && !checkingIn}
        onOpenChange={(next) => {
          if (!next) close()
          else onOpenChange(next)
        }}
        title={`Habitación ${room.number}`}
        description={`${room.room_type_name} - ${room.status_display}`}
        className="max-w-md"
      >
        {room.out_of_service_reason ? (
          <p className="rounded-md bg-status-maintenance/10 px-3 py-2 text-sm text-muted-foreground">
            {room.out_of_service_reason}
          </p>
        ) : null}

        {reservation && rentable ? (
          <div className="rounded-md border border-brand-accent/40 bg-brand-accent/5 px-3 py-2 text-xs">
            {t('recepcion.tieneReservacion')} <strong>{reservation.code}</strong> a nombre de{' '}
            <strong>{reservation.guest_name || t('recepcion.huespedSinNombre')}</strong>, para el{' '}
            {formatDateTime(reservation.scheduled_start)}. Regístrala como llegada para no dejarla
            como no-show.
          </div>
        ) : null}

        <div className="space-y-2">
          {reservation && rentable ? (
            <Button className="w-full justify-start" onClick={() => setCheckingIn(true)}>
              <PiSignIn className="h-4 w-4" />
              {t('recepcion.registrarLlegadaDe', {
                quien: reservation.guest_name || reservation.code,
              })}
            </Button>
          ) : null}

          {rentable ? (
            <Button
              variant={reservation ? 'outline' : 'default'}
              className="w-full justify-start"
              onClick={() => onRent(room)}
            >
              <PiBed className="h-4 w-4" />
              {reservation ? t('recepcion.rentarAOtraPersona') : t('recepcion.rentar')}
            </Button>
          ) : null}

          {room.status === 'CLEANING' ? (
            <Button
              variant="success"
              className="w-full justify-start"
              loading={finishCleaning.isPending}
              onClick={() => finishCleaning.mutate(room.id, { onSuccess: close })}
            >
              <PiSparkle className="h-4 w-4" />
              {t('recepcion.marcarLimpiezaTerminada')}
            </Button>
          ) : null}

          {room.status !== 'MAINTENANCE' && room.status !== 'OCCUPIED' ? (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowReason(true)}
            >
              <PiWrench className="h-4 w-4" />
              {t('recepcion.enviarAMantenimiento')}
            </Button>
          ) : null}
        </div>

        {showReason ? (
          <div className="space-y-3 rounded-md border p-4">
            <Label htmlFor="oos-reason">{t('recepcion.motivo')}</Label>
            <Input
              id="oos-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('recepcion.fugaRegadera')}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReason(false)}>
                {t('recepcion.volver')}
              </Button>
              <Button
                variant="warning"
                disabled={reason.trim().length < 5}
                loading={outOfService.isPending}
                onClick={() =>
                  outOfService.mutate({ roomId: room.id, reason }, { onSuccess: close })
                }
              >
                {t('recepcion.confirmar')}
              </Button>
            </div>
          </div>
        ) : null}
      </ResponsiveDialog>

      <ReservationCheckInDialog
        reservation={reservation ?? null}
        open={checkingIn}
        onOpenChange={(next) => {
          setCheckingIn(next)
          if (!next) close()
        }}
      />
    </>
  )
}
