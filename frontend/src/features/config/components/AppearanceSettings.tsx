import { useEffect, useState } from 'react'
import {
  PiFloppyDisk,
  PiMonitor,
  PiMoon,
  PiRows,
  PiSpeakerHigh,
  PiSpeakerSlash,
  PiSun,
} from 'react-icons/pi'

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
import { useBusinessProfile, useUpdateBusinessProfile } from '@/features/config/hooks'
import type { BusinessProfilePayload } from '@/features/config/types'
import {
  useAppearanceStore,
  type DensityPreference,
  type ThemePreference,
} from '@/store/appearance'
import { useUiStore } from '@/store/ui'
import { cn } from '@/lib/utils'

const COLOR_FIELDS = [
  ['brand_primary_color', 'Color principal', 'Botones, enlaces y selección'],
  ['brand_sidebar_color', 'Menú lateral', 'Fondo del menú principal'],
  ['status_available_color', 'Disponible', 'Habitaciones libres y resultados positivos'],
  ['status_occupied_color', 'Ocupado', 'Rentas activas, vencimientos y errores'],
  ['status_cleaning_color', 'Limpieza', 'Cuartos pendientes y advertencias'],
  ['status_maintenance_color', 'Mantenimiento', 'Bloqueos y trabajos técnicos'],
] as const

type BrandForm = Pick<
  BusinessProfilePayload,
  | 'brand_primary_color'
  | 'brand_sidebar_color'
  | 'status_available_color'
  | 'status_occupied_color'
  | 'status_cleaning_color'
  | 'status_maintenance_color'
  | 'default_theme'
  | 'default_density'
  | 'border_radius'
  | 'font_family'
  | 'login_message'
>

const EMPTY: BrandForm = {
  brand_primary_color: '#3B82F6',
  brand_sidebar_color: '#0F172A',
  status_available_color: '#10B981',
  status_occupied_color: '#EF4444',
  status_cleaning_color: '#F59E0B',
  status_maintenance_color: '#6B7280',
  default_theme: 'light',
  default_density: 'comfortable',
  border_radius: 'medium',
  font_family: 'modern',
  login_message: '',
}

export function AppearanceSettings() {
  const profile = useBusinessProfile()
  const update = useUpdateBusinessProfile()
  const [form, setForm] = useState<BrandForm>(EMPTY)
  const theme = useAppearanceStore((state) => state.theme)
  const density = useAppearanceStore((state) => state.density)
  const setTheme = useAppearanceStore((state) => state.setTheme)
  const setDensity = useAppearanceStore((state) => state.setDensity)
  const soundAlerts = useUiStore((state) => state.soundAlerts)
  const setSoundAlerts = useUiStore((state) => state.setSoundAlerts)

  useEffect(() => {
    if (!profile.data) return
    setForm({
      brand_primary_color: profile.data.brand_primary_color,
      brand_sidebar_color: profile.data.brand_sidebar_color,
      status_available_color: profile.data.status_available_color,
      status_occupied_color: profile.data.status_occupied_color,
      status_cleaning_color: profile.data.status_cleaning_color,
      status_maintenance_color: profile.data.status_maintenance_color,
      default_theme: profile.data.default_theme,
      default_density: profile.data.default_density,
      border_radius: profile.data.border_radius,
      font_family: profile.data.font_family,
      login_message: profile.data.login_message,
    })
  }, [profile.data])

  const set = <K extends keyof BrandForm>(key: K, value: BrandForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <p className="font-medium">Identidad compartida del motel</p>
          <p className="text-xs text-muted-foreground">
            Estos cambios se aplican a todos los usuarios y terminales de esta propiedad.
          </p>
        </div>
        <Button size="sm" loading={update.isPending} onClick={() => update.mutate(form)}>
          <PiFloppyDisk /> Guardar identidad
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paleta del motel</CardTitle>
            <CardDescription>Colores libres en formato hexadecimal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map(([key, label, hint]) => (
              <ColorField
                key={key}
                label={label}
                hint={hint}
                value={String(form[key] ?? '')}
                onChange={(value) => set(key, value)}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estilo de la interfaz</CardTitle>
            <CardDescription>Valores iniciales para nuevos equipos y usuarios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Tema predeterminado"
                value={String(form.default_theme)}
                onChange={(value) => set('default_theme', value as BrandForm['default_theme'])}
                options={[
                  ['light', 'Claro'],
                  ['dark', 'Oscuro'],
                  ['system', 'Seguir el sistema'],
                ]}
              />
              <SelectField
                label="Densidad predeterminada"
                value={String(form.default_density)}
                onChange={(value) => set('default_density', value as BrandForm['default_density'])}
                options={[
                  ['comfortable', 'Cómoda'],
                  ['compact', 'Compacta'],
                ]}
              />
              <SelectField
                label="Bordes y controles"
                value={String(form.border_radius)}
                onChange={(value) => set('border_radius', value as BrandForm['border_radius'])}
                options={[
                  ['square', 'Rectos'],
                  ['medium', 'Equilibrados'],
                  ['rounded', 'Redondeados'],
                ]}
              />
              <SelectField
                label="Tipografía"
                value={String(form.font_family)}
                onChange={(value) => set('font_family', value as BrandForm['font_family'])}
                options={[
                  ['modern', 'Moderna'],
                  ['system', 'Del sistema'],
                  ['rounded', 'Redondeada'],
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-message">Mensaje de la pantalla de acceso</Label>
              <Input
                id="login-message"
                maxLength={140}
                value={String(form.login_message ?? '')}
                onChange={(event) => set('login_message', event.target.value)}
                placeholder="Bienvenido. Ingresa tus datos para continuar."
              />
              <p className="text-2xs text-muted-foreground">
                Se muestra antes de iniciar sesión, sin exponer información operativa.
              </p>
            </div>
            <div
              className="rounded-lg border p-4"
              style={{
                borderRadius:
                  form.border_radius === 'rounded'
                    ? '1rem'
                    : form.border_radius === 'square'
                      ? '0.125rem'
                      : '0.625rem',
              }}
            >
              <p className="mb-3 text-xs font-medium">Vista previa</p>
              <div className="flex flex-wrap gap-2">
                <span
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: form.brand_primary_color }}
                >
                  Acción principal
                </span>
                {COLOR_FIELDS.slice(2).map(([key, label]) => (
                  <span
                    key={key}
                    className="rounded-full px-2 py-1 text-2xs font-medium text-white"
                    style={{ backgroundColor: form[key] }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis preferencias en esta computadora</CardTitle>
          <CardDescription>
            Puedes respetar el estilo del motel o sobrescribir solo tu pantalla.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-3">
          <PreferenceGroup
            label="Tema"
            value={theme}
            onChange={(value) => setTheme(value as ThemePreference)}
            options={[
              ['motel', 'Del motel', PiMonitor],
              ['light', 'Claro', PiSun],
              ['dark', 'Oscuro', PiMoon],
            ]}
          />
          <PreferenceGroup
            label="Densidad"
            value={density}
            onChange={(value) => setDensity(value as DensityPreference)}
            options={[
              ['motel', 'Del motel', PiMonitor],
              ['comfortable', 'Cómoda', PiRows],
              ['compact', 'Compacta', PiRows],
            ]}
          />
          <div className="space-y-2">
            <Label>Alertas sonoras</Label>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setSoundAlerts(!soundAlerts)}
            >
              {soundAlerts ? <PiSpeakerHigh /> : <PiSpeakerSlash />}
              {soundAlerts ? 'Activadas' : 'Silenciadas'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
        />
        <Input
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="font-mono uppercase"
        />
      </div>
      <p className="text-2xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[][]
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key!}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function PreferenceGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string, typeof PiSun]>
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {options.map(([key, text, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border p-2 text-xs',
              value === key && 'border-primary bg-primary/10',
            )}
          >
            <Icon className="h-4 w-4" />
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
