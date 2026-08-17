import { Check, Monitor, Moon, Rows2, Rows3, Sun, Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ACCENTS, useAppearanceStore, type Density, type ThemeMode } from '@/store/appearance'
import { useUiStore } from '@/store/ui'
import { cn } from '@/lib/utils'

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Del sistema', icon: Monitor },
]

const DENSITIES: { value: Density; label: string; hint: string; icon: typeof Rows2 }[] = [
  { value: 'comfortable', label: 'Cómoda', hint: 'Renglones altos', icon: Rows2 },
  { value: 'compact', label: 'Compacta', hint: 'Más filas visibles', icon: Rows3 },
]

function OptionCard({
  selected,
  onSelect,
  icon: Icon,
  label,
  hint,
}: {
  selected: boolean
  onSelect: () => void
  icon: typeof Sun
  label: string
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-all',
        'hover:border-foreground/20 hover:shadow-xs',
        selected ? 'border-foreground/30 bg-accent ring-1 ring-foreground/10' : 'bg-card',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
      {hint ? <span className="text-2xs text-muted-foreground">{hint}</span> : null}
    </button>
  )
}

export function AppearanceSettings() {
  const { theme, accentId, density, setTheme, setAccent, setDensity } = useAppearanceStore()
  const soundAlerts = useUiStore((state) => state.soundAlerts)
  const setSoundAlerts = useUiStore((state) => state.setSoundAlerts)

  return (
    <div className="space-y-4 pb-4">
      <p className="text-xs text-muted-foreground">
        Estas preferencias se guardan solo en esta computadora.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tema y color</CardTitle>
            <CardDescription>
              El acento se aplica a botones principales, menú activo y enfoques.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Tema</Label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((option) => (
                  <OptionCard
                    key={option.value}
                    selected={theme === option.value}
                    onSelect={() => setTheme(option.value)}
                    icon={option.icon}
                    label={option.label}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color de acento</Label>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() => setAccent(accent.id)}
                    title={accent.label}
                    aria-label={accent.label}
                    aria-pressed={accentId === accent.id}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full transition-transform',
                      'hover:scale-110 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                      accentId === accent.id && 'ring-2 ring-foreground/30 ring-offset-2',
                    )}
                    style={{ backgroundColor: `hsl(${accent.hsl})` }}
                  >
                    {accentId === accent.id ? (
                      <Check className="h-4 w-4 text-white" aria-hidden />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-2xs uppercase tracking-wide text-muted-foreground">
                Vista previa
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">Acción principal</Button>
                <Button size="sm" variant="outline">
                  Secundaria
                </Button>
                <span className="rounded-md bg-brand-accent px-2 py-1 text-xs font-medium text-white">
                  Sección activa
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pantalla y avisos</CardTitle>
            <CardDescription>
              Cómo se ven las tablas y si esta terminal suena al vencer una renta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Densidad de las tablas</Label>
              <div className="grid grid-cols-2 gap-2">
                {DENSITIES.map((option) => (
                  <OptionCard
                    key={option.value}
                    selected={density === option.value}
                    onSelect={() => setDensity(option.value)}
                    icon={option.icon}
                    label={option.label}
                    hint={option.hint}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alertas sonoras</Label>
              <button
                type="button"
                onClick={() => setSoundAlerts(!soundAlerts)}
                aria-pressed={soundAlerts}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-all',
                  'hover:border-foreground/20 hover:shadow-xs',
                  soundAlerts ? 'border-foreground/30 bg-accent' : 'bg-card',
                )}
              >
                {soundAlerts ? (
                  <Volume2 className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block font-medium">
                    {soundAlerts ? 'Activadas' : 'Silenciadas'}
                  </span>
                  <span className="block text-2xs text-muted-foreground">
                    Tono al avisar que una renta está por vencer o ya vencio.
                  </span>
                </span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
