import { useEffect, useRef, useState } from 'react'
import { PiFloppyDisk, PiImageSquare, PiTrash } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import {
  useBusinessProfile,
  useTimeZones,
  useUpdateBusinessLogo,
  useUpdateBusinessProfile,
} from '@/features/config/hooks'
import {
  PRINTER_BACKENDS,
  type BusinessProfile,
  type BusinessProfilePayload,
  type PrinterBackend,
} from '@/features/config/types'

const MAX_LOGO_KB = 512

interface Draft {
  name: string
  legal_name: string
  tax_id: string
  address: string
  phone: string
  email: string
  currency: string
  locale: string
  time_zone: string
  ticket_footer: string
  print_ticket_on_close: boolean
  expiration_warning_minutes: string
  expense_approval_threshold: string
  printer_backend: PrinterBackend
  printer_host: string
  printer_port: string
}

function toDraft(profile: BusinessProfile): Draft {
  return {
    name: profile.name,
    legal_name: profile.legal_name,
    tax_id: profile.tax_id,
    address: profile.address,
    phone: profile.phone,
    email: profile.email,
    currency: profile.currency,
    locale: profile.locale,
    time_zone: profile.time_zone,
    ticket_footer: profile.ticket_footer,
    print_ticket_on_close: profile.print_ticket_on_close,
    expiration_warning_minutes: String(profile.expiration_warning_minutes),
    expense_approval_threshold: profile.expense_approval_threshold,
    printer_backend: profile.printer_backend,
    printer_host: profile.printer_host,
    printer_port: String(profile.printer_port),
  }
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function BusinessSettings() {
  const { data: profile, isLoading } = useBusinessProfile()
  const { data: timeZones } = useTimeZones()
  const update = useUpdateBusinessProfile()
  const updateLogo = useUpdateBusinessLogo()

  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    if (profile) setDraft(toDraft(profile))
  }, [profile])

  if (isLoading || !profile || !draft) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]): void =>
    setDraft((current) => (current ? { ...current, [key]: value } : current))

  const original = toDraft(profile)
  const dirty = (Object.keys(original) as (keyof Draft)[]).filter(
    (key) => draft[key] !== original[key],
  )

  const handleLogo = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Archivo no válido', 'Elige una imagen PNG, JPG o WEBP.')
      return
    }
    if (file.size > MAX_LOGO_KB * 1024) {
      toast.error('Imagen muy pesada', `El límite es ${MAX_LOGO_KB} KB.`)
      return
    }

    updateLogo.mutate(file)
  }

  const save = (): void => {
    if (dirty.length === 0) return

    const payload: BusinessProfilePayload = {}
    for (const key of dirty) {
      if (key === 'expiration_warning_minutes') {
        payload.expiration_warning_minutes = Number(draft.expiration_warning_minutes) || 1
      } else if (key === 'printer_port') {
        payload.printer_port = Number(draft.printer_port) || 9100
      } else if (key === 'print_ticket_on_close') {
        payload.print_ticket_on_close = draft.print_ticket_on_close
      } else {
        payload[key] = draft[key] as never
      }
    }

    update.mutate(payload)
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {dirty.length > 0
            ? `${dirty.length} campo${dirty.length === 1 ? '' : 's'} sin guardar.`
            : 'Todo guardado. Estos datos son iguales en todas las terminales.'}
        </p>
        <Button size="sm" onClick={save} disabled={dirty.length === 0} loading={update.isPending}>
          <PiFloppyDisk />
          Guardar cambios
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identidad</CardTitle>
            <CardDescription>
              El nombre sale en el menú, en la pantalla de acceso, en el título de la pestaña y en
              el ticket.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nombre comercial" htmlFor="business-name">
              <Input
                id="business-name"
                value={draft.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="Motel Los Arcos"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Razón social" htmlFor="business-legal">
                <Input
                  id="business-legal"
                  value={draft.legal_name}
                  onChange={(event) => set('legal_name', event.target.value)}
                />
              </Field>
              <Field label="RFC" htmlFor="business-tax">
                <Input
                  id="business-tax"
                  value={draft.tax_id}
                  onChange={(event) => set('tax_id', event.target.value.toUpperCase())}
                  className="uppercase"
                />
              </Field>
            </div>

            <Field label="Dirección" htmlFor="business-address">
              <Input
                id="business-address"
                value={draft.address}
                onChange={(event) => set('address', event.target.value)}
                placeholder="Carretera federal km 12, Xalapa"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Teléfono" htmlFor="business-phone">
                <Input
                  id="business-phone"
                  value={draft.phone}
                  onChange={(event) => set('phone', event.target.value)}
                />
              </Field>
              <Field label="Correo" htmlFor="business-email">
                <Input
                  id="business-email"
                  type="email"
                  value={draft.email}
                  onChange={(event) => set('email', event.target.value)}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <Label>Logotipo</Label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {profile.logo_url ? (
                    <img
                      src={profile.logo_url}
                      alt="Logotipo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <PiImageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={updateLogo.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    <PiImageSquare />
                    {profile.logo_url ? 'Cambiar imagen' : 'Subir imagen'}
                  </Button>
                  {profile.logo_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => updateLogo.mutate(null)}
                    >
                      <PiTrash />
                      Quitar
                    </Button>
                  ) : null}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogo}
                />
              </div>
              <p className="text-2xs text-muted-foreground">
                PNG, JPG o WEBP de hasta {MAX_LOGO_KB} KB. Se guarda en el servidor y tambien se usa
                como icono de la pestaña. El logotipo se aplica al momento, sin necesidad de
                guardar.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Moneda y zona horaria</CardTitle>
              <CardDescription>
                Definen cómo se muestran los importes y a qué hora corta el día de operación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Moneda" htmlFor="business-currency" hint="Código ISO: MXN, USD...">
                  <Input
                    id="business-currency"
                    value={draft.currency}
                    onChange={(event) => set('currency', event.target.value.toUpperCase())}
                    maxLength={3}
                    className="uppercase"
                  />
                </Field>
                <Field label="Formato regional" htmlFor="business-locale" hint="es-MX, en-US...">
                  <Input
                    id="business-locale"
                    value={draft.locale}
                    onChange={(event) => set('locale', event.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="Zona horaria"
                htmlFor="business-tz"
                hint="El servidor guarda todo en UTC; esto solo define la hora local del negocio."
              >
                <Select value={draft.time_zone} onValueChange={(value) => set('time_zone', value)}>
                  <SelectTrigger id="business-tz">
                    <SelectValue placeholder="Elige la zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {(timeZones ?? []).map((zone) => (
                      <SelectItem key={zone.value} value={zone.value}>
                        {zone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reglas de operación</CardTitle>
              <CardDescription>
                Cambian el comportamiento del sistema sin tocar el servidor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Aviso de vencimiento"
                  htmlFor="business-warning"
                  hint="Minutos antes de que se acabe la renta."
                >
                  <Input
                    id="business-warning"
                    type="number"
                    min={1}
                    max={240}
                    value={draft.expiration_warning_minutes}
                    onChange={(event) => set('expiration_warning_minutes', event.target.value)}
                  />
                </Field>
                <Field
                  label="Gasto que requiere aprobación"
                  htmlFor="business-threshold"
                  hint="Arriba de este monto, lo autoriza gerencia."
                >
                  <Input
                    id="business-threshold"
                    inputMode="decimal"
                    value={draft.expense_approval_threshold}
                    onChange={(event) => set('expense_approval_threshold', event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Pie del ticket" htmlFor="business-footer">
                <Input
                  id="business-footer"
                  value={draft.ticket_footer}
                  onChange={(event) => set('ticket_footer', event.target.value)}
                  placeholder="Gracias por su visita"
                />
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.print_ticket_on_close}
                  onChange={(event) => set('print_ticket_on_close', event.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Imprimir el ticket al cerrar la cuenta
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Impresora</CardTitle>
              <CardDescription>
                «Sin impresora» guarda el comprobante igual: se puede reimprimir después.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Tipo" htmlFor="printer-backend">
                <Select
                  value={draft.printer_backend}
                  onValueChange={(value) => set('printer_backend', value as PrinterBackend)}
                >
                  <SelectTrigger id="printer-backend">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINTER_BACKENDS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {draft.printer_backend === 'network' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Dirección IP" htmlFor="printer-host">
                    <Input
                      id="printer-host"
                      value={draft.printer_host}
                      onChange={(event) => set('printer_host', event.target.value)}
                      placeholder="192.168.1.100"
                    />
                  </Field>
                  <Field label="Puerto" htmlFor="printer-port">
                    <Input
                      id="printer-port"
                      type="number"
                      min={1}
                      max={65535}
                      value={draft.printer_port}
                      onChange={(event) => set('printer_port', event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
