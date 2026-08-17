import { useRef } from 'react'
import { Check, ImageUp, Monitor, Moon, Sun, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { ACCENTS, useAppearanceStore, type ThemeMode } from '@/store/appearance'
import { cn } from '@/lib/utils'

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Del sistema', icon: Monitor },
]

/** Tamaño máximo del logotipo: se guarda embebido, no en disco. */
const MAX_LOGO_KB = 512

export function AppearanceSettings() {
  const fileRef = useRef<HTMLInputElement>(null)
  const { theme, accentId, logo, businessName, setTheme, setAccent, setLogo, setBusinessName } =
    useAppearanceStore()

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Archivo no válido', 'Elige una imagen (PNG, JPG o SVG).')
      return
    }
    if (file.size > MAX_LOGO_KB * 1024) {
      toast.error('Imagen muy pesada', `El límite es ${MAX_LOGO_KB} KB.`)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setLogo(String(reader.result))
      toast.success('Logotipo actualizado')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidad</CardTitle>
          <CardDescription>
            Nombre y logotipo que se muestran en el menú y en la pantalla de acceso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Nombre del negocio</Label>
            <Input
              id="business-name"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Motel Los Arcos"
            />
          </div>

          <div className="space-y-2">
            <Label>Logotipo</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                {logo ? (
                  <img src={logo} alt="Logotipo" className="h-full w-full object-contain" />
                ) : (
                  <ImageUp className="h-5 w-5 text-muted-foreground" aria-hidden />
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImageUp />
                  {logo ? 'Cambiar imagen' : 'Subir imagen'}
                </Button>
                {logo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setLogo(null)}
                  >
                    <Trash2 />
                    Quitar
                  </Button>
                ) : null}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleFile}
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              PNG, JPG, SVG o WEBP de hasta {MAX_LOGO_KB} KB. Se guarda en este equipo.
            </p>
          </div>
        </CardContent>
      </Card>

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
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-all',
                    'hover:border-foreground/20 hover:shadow-xs',
                    theme === option.value
                      ? 'border-foreground/30 bg-accent ring-1 ring-foreground/10'
                      : 'bg-card',
                  )}
                  aria-pressed={theme === option.value}
                >
                  <option.icon className="h-4 w-4" aria-hidden />
                  {option.label}
                </button>
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
    </div>
  )
}
