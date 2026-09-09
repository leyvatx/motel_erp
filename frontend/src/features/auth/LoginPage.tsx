import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { PiArrowLeft, PiBed } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { useLogin } from '@/features/auth/hooks'
import { usePublicBusinessProfile, useBrand } from '@/features/config/hooks'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiErrorMessage } from '@/lib/axios'
import { APP_FALLBACK_NAME } from '@/lib/brand'
import { defaultRouteFor, useAuthStore } from '@/store/auth'

const loginSchema = z.object({
  // Acepta las dos formas de identificarse -- clave de empleado y correo -- sin
  // pedir formato de ninguna: exigir que parezca correo dejaba fuera a quien
  // entra con su clave, y exigir que no lo parezca, al revés. El servidor busca
  // por los dos campos y sabe cuál es cuál.
  username: z.string().trim().min(3, 'Escribe tu usuario o tu correo.').toLowerCase(),
  password: z.string().min(1, 'Escribe tu contraseña.'),
  motel: z.string().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const access = useAuthStore((state) => state.access)
  const user = useAuthStore((state) => state.user)
  const { name: businessName, logoUrl } = useBrand()
  const publicProfile = usePublicBusinessProfile()
  const login = useLogin()

  useDocumentTitle('Acceso')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  if (access) return <Navigate to={defaultRouteFor(user)} replace />

  const askForMotel = login.isError
  const onSubmit = handleSubmit((values) => login.mutate(values))

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid-surface grid-fade pointer-events-none absolute inset-0" aria-hidden />

      {/* Salida hacia la página pública. Es un enlace del router, no un
          `window.location`: no recarga el bundle, no toca la sesión y no deja
          la pantalla en blanco mientras vuelve. Antes no había forma de salir
          de aquí sin escribir la dirección a mano. */}
      <Link
        to="/"
        className="absolute left-3 top-3 inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:left-5 sm:top-5"
      >
        <PiArrowLeft className="h-4 w-4" aria-hidden />
        Volver al sitio
      </Link>

      <div className="relative w-full max-w-[22rem] space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border bg-card">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <PiBed className="h-5 w-5" aria-hidden />
            )}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tightest">
              {businessName || APP_FALLBACK_NAME}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {publicProfile.data?.login_message ||
                'Ingresa con tu clave de empleado para continuar.'}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">Correo electrónico o nombre de usuario</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="recepcion  ·  laura@tunegocio.mx"
                aria-invalid={Boolean(errors.username)}
                {...register('username')}
              />
              {errors.username ? (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"

                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>

            {askForMotel ? (
              <div className="space-y-2">
                <Label htmlFor="motel">Sucursal</Label>
                <Input
                  id="motel"
                  placeholder="arcos-del-sur"
                  className="font-mono"
                  {...register('motel')}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Solo si trabajas en otra sucursal: escribe su identificador.
                </p>
              </div>
            ) : null}

            {login.isError ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm leading-relaxed text-destructive"
              >
                {apiErrorMessage(login.error, 'Usuario o contraseña incorrectos.')}
              </p>
            ) : null}

            <Button type="submit" className="h-11 w-full lg:h-10" loading={login.isPending}>
              Entrar
            </Button>
          </form>
        </div>

        <div className="space-y-4 text-center text-xs leading-relaxed text-muted-foreground">
          <button
            type="button"
            onClick={() => setAyudaAbierta(true)}
            className="rounded-md px-2 py-1 font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            ¿Olvidaste tu contraseña?
          </button>

          {/* Alta de negocio y acceso de empleado son puertas distintas y se
              ven distintas. Quien trabaja aquí ya tiene usuario: si el enlace
              de arriba dijera "crea tu cuenta" a secas, acabaría dando de alta
              un negocio nuevo en vez de pedir su clave a gerencia. */}
          <div className="border-t pt-4">
            <p>¿Vienes a dar de alta tu negocio, no a trabajar?</p>
            <Link
              to="/registro"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Crear una cuenta para mi negocio
            </Link>
          </div>
        </div>
      </div>

      {/* Recuperación por gerencia, no por correo: la API todavía no expone un
          flujo de restablecimiento (haría falta POST /auth/password-reset/ con
          envío de correo y POST /auth/password-reset/confirm/ con token). Hasta
          entonces esto dice el camino real en vez de mandar a un formulario que
          no existe. */}
      <ResponsiveDialog
        open={ayudaAbierta}
        onOpenChange={setAyudaAbierta}
        title="¿Olvidaste tu contraseña?"
        description="Tu clave la restablece quien administra el sistema."
        className="sm:max-w-md"
        footer={<Button onClick={() => setAyudaAbierta(false)}>Entendido</Button>}
      >
        <ol className="space-y-3 text-sm leading-relaxed">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
              1
            </span>
            Pídele a gerencia o al encargado del turno que entre a Usuarios.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
              2
            </span>
            Ahí puede darte una contraseña temporal para tu usuario.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
              3
            </span>
            Al entrar con ella, el sistema te pedirá que elijas una nueva.
          </li>
        </ol>
      </ResponsiveDialog>
    </div>
  )
}
