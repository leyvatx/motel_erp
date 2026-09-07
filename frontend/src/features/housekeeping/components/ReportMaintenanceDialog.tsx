import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PiCamera, PiTrash } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
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
import { apiFieldErrors } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'PLUMBING', label: 'Agua o drenaje' },
  { value: 'ELECTRICAL', label: 'Luz o contactos' },
  { value: 'AIR_CONDITIONING', label: 'Clima' },
  { value: 'FURNITURE', label: 'Mueble roto' },
  { value: 'ELECTRONICS', label: 'Televisión o aparatos' },
  { value: 'STRUCTURE', label: 'Puerta, ventana o pared' },
  { value: 'OTHER', label: 'Otra cosa' },
] as const

const PRIORITIES: { value: MaintenancePriority; label: string; ayuda: string }[] = [
  { value: 'LOW', label: 'Puede esperar', ayuda: 'No estorba para rentar' },
  { value: 'MEDIUM', label: 'Normal', ayuda: 'Hay que arreglarlo pronto' },
  { value: 'HIGH', label: 'Urgente', ayuda: 'Molesta al huésped' },
  { value: 'URGENT', label: 'No se puede usar', ayuda: 'El cuarto no sirve así' },
]

const MAX_BYTES = 4 * 1024 * 1024

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultRoomId?: number | null
}

/**
 * Reportar un problema, pensado para quien lo encuentra: alguien de pie en la
 * habitación, con el teléfono en la mano y guantes puestos.
 *
 * Por eso es hoja inferior en el móvil y no un modal centrado, los campos
 * preguntan en lenguaje de limpieza ("Agua o drenaje", no "Plomería") y la foto
 * abre la cámara trasera directamente: describir una fuga por escrito cuesta
 * más que enseñarla.
 */
export function ReportMaintenanceDialog({ open, onOpenChange, defaultRoomId }: Props) {
  const report = useReportMaintenance()
  const archivoRef = useRef<HTMLInputElement>(null)
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
  const [foto, setFoto] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)

  useEffect(() => {
    if (defaultRoomId) setRoomId(String(defaultRoomId))
  }, [defaultRoomId])

  // La miniatura es un blob del navegador: se revoca al cambiarla o al cerrar,
  // porque una foto de cámara ocupa varios MB en memoria hasta que se suelta.
  useEffect(() => {
    if (!foto) {
      setVistaPrevia(null)
      return
    }
    const url = URL.createObjectURL(foto)
    setVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  const errores = apiFieldErrors(report.error)
  const isValid = title.trim().length >= 5 && description.trim().length >= 5

  const elegirFoto = (archivo: File | undefined): void => {
    if (!archivo) return
    if (archivo.size > MAX_BYTES) {
      setErrorFoto('La foto pesa más de 4 MB. Toma una nueva sin acercar tanto.')
      return
    }
    setErrorFoto(null)
    setFoto(archivo)
  }

  const limpiar = (): void => {
    setTitle('')
    setDescription('')
    setBlocksRoom(false)
    setFoto(null)
    setErrorFoto(null)
    if (archivoRef.current) archivoRef.current.value = ''
  }

  const submit = (): void => {
    report.mutate(
      {
        title,
        description,
        room_id: roomId ? Number(roomId) : null,
        category,
        priority,
        blocks_room: blocksRoom,
        photo: foto,
      },
      {
        onSuccess: () => {
          limpiar()
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reportar un problema"
      description="Queda con folio y seguimiento hasta que alguien lo cierre."
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!isValid} loading={report.isPending} onClick={submit}>
            Enviar reporte
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">¿Qué pasa?</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Gotea la regadera"
            className="h-11"
          />
          {errores.title ? <p className="text-xs text-destructive">{errores.title}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Cuéntalo con detalle</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Gotea sin parar y ya mojó el piso del baño."
            rows={3}
          />
          {errores.description ? (
            <p className="text-xs text-destructive">{errores.description}</p>
          ) : null}
        </div>

        {/* La cámara trasera, directo. `capture` es lo que evita el paseo por la
            galería; en escritorio el navegador lo ignora y abre el explorador
            de archivos, que ahí es justo lo que se espera. */}
        <div className="space-y-2">
          <Label>Foto (opcional)</Label>
          <input
            ref={archivoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            id="foto-reporte"
            onChange={(event) => elegirFoto(event.target.files?.[0])}
          />

          {vistaPrevia ? (
            <div className="flex items-center gap-3 rounded-lg border p-2">
              <img
                src={vistaPrevia}
                alt="Foto del problema"
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{foto?.name}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 text-destructive"
                aria-label="Quitar la foto"
                onClick={() => {
                  setFoto(null)
                  if (archivoRef.current) archivoRef.current.value = ''
                }}
              >
                <PiTrash />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="h-12 w-full justify-start gap-2"
              onClick={() => archivoRef.current?.click()}
            >
              <PiCamera className="h-5 w-5" />
              Tomar una foto
            </Button>
          )}

          {errorFoto ? <p className="text-xs text-destructive">{errorFoto}</p> : null}
          {errores.photo ? <p className="text-xs text-destructive">{errores.photo}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="room">¿Dónde?</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger id="room" className="h-11">
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
            <Label htmlFor="category">¿De qué es?</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="h-11">
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

        {/* Botones y no un desplegable: la urgencia es la decisión que cambia
            si alguien va corriendo o no, y merece verse entera de un vistazo. */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">¿Qué tan urgente es?</legend>
          <div className="grid grid-cols-2 gap-2">
            {PRIORITIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriority(option.value)}
                aria-pressed={priority === option.value}
                className={cn(
                  'min-h-[3rem] rounded-lg border px-3 py-2 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                  priority === option.value
                    ? 'border-foreground/30 bg-accent'
                    : 'hover:bg-accent/50',
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-2xs text-muted-foreground">{option.ayuda}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-2.5 rounded-lg bg-accent/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={blocksRoom}
            onChange={(event) => setBlocksRoom(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            El cuarto no se puede rentar así
            <span className="block text-xs text-muted-foreground">
              Queda fuera de servicio hasta que el reporte se cierre.
            </span>
          </span>
        </label>
      </div>
    </ResponsiveDialog>
  )
}
