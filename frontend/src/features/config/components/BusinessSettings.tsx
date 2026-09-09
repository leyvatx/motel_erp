import { useEffect, useRef, useState } from 'react'
import { PiFloppyDisk, PiImageSquare, PiTrash } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

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
import { ImageWithFallback } from '@/components/ui/image'

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
  const { t } = useTranslation()
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
      toast.error(t('config.archivoNoValido'), t('config.eligeUnaImagen'))
      return
    }
    if (file.size > MAX_LOGO_KB * 1024) {
      toast.error(t('config.imagenMuyPesada'), `El límite es ${MAX_LOGO_KB} KB.`)
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
            : t('config.todoGuardado')}
        </p>
        <Button size="sm" onClick={save} disabled={dirty.length === 0} loading={update.isPending}>
          <PiFloppyDisk />
          {t('config.guardarCambios')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('config.identidad')}</CardTitle>
            <CardDescription>{t('config.nombreSaleLargo')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t('config.nombreComercial')} htmlFor="business-name">
              <Input
                id="business-name"
                value={draft.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder={t('config.ejemploSucursal')}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('config.razonSocial')} htmlFor="business-legal">
                <Input
                  id="business-legal"
                  value={draft.legal_name}
                  onChange={(event) => set('legal_name', event.target.value)}
                />
              </Field>
              <Field label={t('config.rfc')} htmlFor="business-tax">
                <Input
                  id="business-tax"
                  value={draft.tax_id}
                  onChange={(event) => set('tax_id', event.target.value.toUpperCase())}
                  className="uppercase"
                />
              </Field>
            </div>

            <Field label={t('config.direccion')} htmlFor="business-address">
              <Input
                id="business-address"
                value={draft.address}
                onChange={(event) => set('address', event.target.value)}
                placeholder={t('config.ejemploDireccion')}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('config.telefono')} htmlFor="business-phone">
                <Input
                  id="business-phone"
                  value={draft.phone}
                  onChange={(event) => set('phone', event.target.value)}
                />
              </Field>
              <Field label={t('config.correo')} htmlFor="business-email">
                <Input
                  id="business-email"
                  type="email"
                  value={draft.email}
                  onChange={(event) => set('email', event.target.value)}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <Label>{t('config.logotipo')}</Label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  <ImageWithFallback
                    src={profile.logo_url}
                    alt={t('config.logotipo')}
                    className="h-full w-full object-contain"
                    fallback={
                      <PiImageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
                    }
                  />
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
                      {t('config.quitar')}
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
                {t('config.logotipoDetalle', { kb: MAX_LOGO_KB })}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('config.monedaYZona')}</CardTitle>
              <CardDescription>{t('config.definenImportes')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t('config.moneda')}
                  htmlFor="business-currency"
                  hint={t('config.codigoIso')}
                >
                  <Input
                    id="business-currency"
                    value={draft.currency}
                    onChange={(event) => set('currency', event.target.value.toUpperCase())}
                    maxLength={3}
                    className="uppercase"
                  />
                </Field>
                <Field
                  label={t('config.formatoRegional')}
                  htmlFor="business-locale"
                  hint={t('config.ejemploLocale')}
                >
                  <Input
                    id="business-locale"
                    value={draft.locale}
                    onChange={(event) => set('locale', event.target.value)}
                  />
                </Field>
              </div>

              <Field
                label={t('config.zonaHoraria')}
                htmlFor="business-tz"
                hint={t('config.servidorUtc')}
              >
                <Select value={draft.time_zone} onValueChange={(value) => set('time_zone', value)}>
                  <SelectTrigger id="business-tz">
                    <SelectValue placeholder={t('config.eligeLaZona')} />
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
              <CardTitle className="text-base">{t('config.reglasDeOperacion')}</CardTitle>
              <CardDescription>{t('config.cambianComportamiento')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t('config.avisoVencimiento')}
                  htmlFor="business-warning"
                  hint={t('config.minutosAntes')}
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
                  label={t('config.gastoAprobacion')}
                  htmlFor="business-threshold"
                  hint={t('config.arribaDeMonto')}
                >
                  <Input
                    id="business-threshold"
                    inputMode="decimal"
                    value={draft.expense_approval_threshold}
                    onChange={(event) => set('expense_approval_threshold', event.target.value)}
                  />
                </Field>
              </div>

              <Field label={t('config.pieDelTicket')} htmlFor="business-footer">
                <Input
                  id="business-footer"
                  value={draft.ticket_footer}
                  onChange={(event) => set('ticket_footer', event.target.value)}
                  placeholder={t('config.graciasPorSuVisita')}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.print_ticket_on_close}
                  onChange={(event) => set('print_ticket_on_close', event.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                {t('config.imprimirTicket')}
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('config.impresora')}</CardTitle>
              <CardDescription>{t('config.sinImpresoraDetalle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label={t('config.tipo')} htmlFor="printer-backend">
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
                  <Field label={t('config.direccionIp')} htmlFor="printer-host">
                    <Input
                      id="printer-host"
                      value={draft.printer_host}
                      onChange={(event) => set('printer_host', event.target.value)}
                      placeholder="192.168.1.100"
                    />
                  </Field>
                  <Field label={t('config.puerto')} htmlFor="printer-port">
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
