import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { BedDouble } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/features/auth/hooks'
import { apiErrorMessage } from '@/lib/axios'
import { useAppearanceStore } from '@/store/appearance'
import { useAuthStore } from '@/store/auth'

const loginSchema = z.object({
  username: z.string().min(3, 'Escribe tu usuario.').toLowerCase(),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const access = useAuthStore((state) => state.access)
  const logo = useAppearanceStore((state) => state.logo)
  const businessName = useAppearanceStore((state) => state.businessName)
  const login = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  if (access) return <Navigate to="/frontdesk" replace />

  const onSubmit = handleSubmit((values) => login.mutate(values))

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-brand-dark">
            {logo ? (
              <img src={logo} alt="" className="h-full w-full object-contain" />
            ) : (
              <BedDouble className="h-5 w-5 text-white" aria-hidden />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{businessName}</h1>
            <p className="text-sm text-muted-foreground">
              Ingresa con tu clave de empleado para continuar.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  placeholder="recepcion"
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

              {login.isError ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {apiErrorMessage(login.error, 'Usuario o contraseña incorrectos.')}
                </p>
              ) : null}

              <Button type="submit" className="w-full" loading={login.isPending}>
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Si olvidaste tu contraseña, pídele a gerencia que la restablezca.
        </p>
      </div>
    </div>
  )
}
