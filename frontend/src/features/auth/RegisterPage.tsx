import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { LuArrowLeft, LuBuilding2, LuEye, LuEyeOff } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSignup } from '@/features/auth/hooks'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiErrorMessage, apiFieldErrors } from '@/lib/axios'
import { cn } from '@/lib/utils'
import { defaultRouteFor, useAuthStore } from '@/store/auth'

const registroSchema = z.object({
  business_name: z.string().trim().min(2, 'Escribe el nombre del negocio.').max(120),
  admin_full_name: z.string().trim().min(3, 'Escribe tu nombre completo.').max(150),
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
  password: z.string().min(8, 'Al menos 8 caracteres.'),
})

type RegistroForm = z.infer<typeof registroSchema>

const CAMPOS = ['business_name', 'admin_full_name', 'email', 'password'] as const

/** Los cuatro dominios que cubren casi todo el correo personal en México.
 *  No es autocompletado real -- eso pide una lista que nadie va a mantener --
 *  sino ahorrarse teclear la parte que siempre se escribe igual. */
const DOMINIOS = ['@gmail.com', '@outlook.com', '@hotmail.com', '@icloud.com']

/** Alta de autoservicio: cuatro campos y adentro.
 *
 *  Se piden los cuatro que no tienen valor por omisión posible. Zona horaria,
 *  moneda, tarifas y habitaciones se configuran en el asistente que aparece
 *  apenas entra: preguntarlos aquí alarga el formulario justo donde más gente
 *  lo abandona.
 */
export default function RegisterPage() {
  const access = useAuthStore((state) => state.access)
  const user = useAuthStore((state) => state.user)
  const signup = useSignup()
  const [verClave, setVerClave] = useState(false)

  useDocumentTitle('Crear cuenta')

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    watch,
    formState: { errors },
  } = useForm<RegistroForm>({
    resolver: zodResolver(registroSchema),
    defaultValues: { business_name: '', admin_full_name: '', email: '', password: '' },
  })

  const correo = watch('email')

  // Las sugerencias solo estorban una vez que el dominio ya está escrito: se
  // muestran mientras haya algo antes de la arroba y nada -- o poco -- después.
  const [local = '', dominio] = correo.split('@')
  const sugerirDominios = local.length > 0 && (dominio === undefined || !dominio.includes('.'))

  if (access) return <Navigate to={defaultRouteFor(user)} replace />

  const onSubmit = handleSubmit((values) =>
    signup.mutate(values, {
      onError: (error) => {
        // La API dice exactamente qué campo falló y por qué; hasta ahora todo
        // eso terminaba resumido en un banner que no decía cuál era el malo.
        const porCampo = apiFieldErrors(error)
        const conocidos = CAMPOS.filter((campo) => porCampo[campo])
        conocidos.forEach((campo, indice) =>
          setError(campo, { message: porCampo[campo] }, { shouldFocus: indice === 0 }),
        )
      },
    }),
  )

  // Si el error ya quedó pintado bajo su input, el banner solo repite.
  const errorGeneral =
    signup.isError && !CAMPOS.some((campo) => errors[campo])
      ? apiErrorMessage(signup.error, 'No se pudo crear la cuenta.')
      : null

  const completarDominio = (sufijo: string): void => {
    setValue('email', `${local}${sufijo}`, { shouldValidate: true, shouldDirty: true })
    setFocus('password')
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid-surface grid-fade pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative w-full max-w-[24rem] space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
            <LuBuilding2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tightest">Crea tu cuenta</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Da de alta tu negocio y configúralo en cuatro pasos.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="business_name">Nombre del negocio</Label>
              <Input
                id="business_name"
                autoFocus
                autoComplete="organization"
                placeholder="Motel Las Palmas"
                aria-invalid={Boolean(errors.business_name)}
                {...register('business_name')}
              />
              {errors.business_name ? (
                <p role="alert" className="text-xs leading-relaxed text-destructive">
                  {errors.business_name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_full_name">Tu nombre</Label>
              <Input
                id="admin_full_name"
                autoComplete="name"
                placeholder="Laura Domínguez"
                aria-invalid={Boolean(errors.admin_full_name)}
                {...register('admin_full_name')}
              />
              {errors.admin_full_name ? (
                <p role="alert" className="text-xs leading-relaxed text-destructive">
                  {errors.admin_full_name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="laura@laspalmas.mx"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />

              {sugerirDominios ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {DOMINIOS.map((sufijo) => (
                    <button
                      key={sufijo}
                      type="button"
                      onClick={() => completarDominio(sufijo)}
                      aria-label={`Completar como ${local}${sufijo}`}
                      className={cn(
                        'rounded-md border border-border/60 px-2 py-1 font-mono text-2xs',
                        'text-muted-foreground transition-colors duration-150',
                        'hover:border-foreground/25 hover:bg-accent hover:text-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      {sufijo}
                    </button>
                  ))}
                </div>
              ) : null}

              {errors.email ? (
                <p role="alert" className="text-xs leading-relaxed text-destructive">
                  {errors.email.message}
                </p>
              ) : sugerirDominios ? null : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  De aquí sale tu clave de acceso al sistema.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={verClave ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setVerClave((visible) => !visible)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verClave}
                  className={cn(
                    'absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md',
                    'text-muted-foreground transition-colors duration-150 hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  )}
                >
                  {verClave ? (
                    <LuEyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <LuEye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {errors.password ? (
                <p role="alert" className="text-xs leading-relaxed text-destructive">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {errorGeneral ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm leading-relaxed text-destructive"
              >
                {errorGeneral}
              </p>
            ) : null}

            <Button type="submit" className="h-11 w-full lg:h-10" loading={signup.isPending}>
              Crear cuenta y empezar
            </Button>
          </form>
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <LuArrowLeft className="h-3 w-3" aria-hidden />
            Ya tengo cuenta
          </Link>
        </p>
      </div>
    </div>
  )
}
