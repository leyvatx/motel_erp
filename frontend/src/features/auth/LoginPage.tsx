import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { PiBed } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/features/auth/hooks'
import { usePublicBusinessProfile, useBrand } from '@/features/config/hooks'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiErrorMessage } from '@/lib/axios'
import { defaultRouteFor, useAuthStore } from '@/store/auth'

const loginSchema = z.object({
  username: z.string().min(3, 'Escribe tu usuario.').toLowerCase(),
  password: z.string().min(1, 'Escribe tu contraseña.'),
  motel: z.string().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
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
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid-surface grid-fade pointer-events-none absolute inset-0" aria-hidden />

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
              {businessName || 'Motel ERP'}
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
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                placeholder="recepcion"
                className="h-11 font-mono lg:h-10"
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
                className="h-11 lg:h-10"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>

            {askForMotel ? (
              <div className="space-y-2">
                <Label htmlFor="motel">Motel</Label>
                <Input
                  id="motel"
                  placeholder="arcos-del-sur"
                  className="h-11 font-mono lg:h-10"
                  {...register('motel')}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Solo si trabajas en otro motel: escribe su identificador.
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

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Si olvidaste tu contraseña, pídele a gerencia que la restablezca.
        </p>
      </div>
    </div>
  )
}
