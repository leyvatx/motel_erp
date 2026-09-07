import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { LuArrowLeft, LuBuilding2 } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSignup } from '@/features/auth/hooks'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiErrorMessage } from '@/lib/axios'
import { defaultRouteFor, useAuthStore } from '@/store/auth'

const registroSchema = z.object({
  business_name: z.string().trim().min(2, 'Escribe el nombre del negocio.').max(120),
  admin_full_name: z.string().trim().min(3, 'Escribe tu nombre completo.').max(150),
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
  password: z.string().min(8, 'Al menos 8 caracteres.'),
})

type RegistroForm = z.infer<typeof registroSchema>

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

  useDocumentTitle('Crear cuenta')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistroForm>({
    resolver: zodResolver(registroSchema),
    defaultValues: { business_name: '', admin_full_name: '', email: '', password: '' },
  })

  if (access) return <Navigate to={defaultRouteFor(user)} replace />

  const onSubmit = handleSubmit((values) => signup.mutate(values))

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
                <p className="text-xs text-destructive">{errors.business_name.message}</p>
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
                <p className="text-xs text-destructive">{errors.admin_full_name.message}</p>
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
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  De aquí sale tu clave de acceso al sistema.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>

            {signup.isError ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm leading-relaxed text-destructive"
              >
                {apiErrorMessage(signup.error, 'No se pudo crear la cuenta.')}
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
