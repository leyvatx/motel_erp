import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { LuArrowLeft, LuBuilding2, LuEye, LuEyeOff } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PreparandoEspacio } from '@/features/auth/PreparandoEspacio'
import { useSignup } from '@/features/auth/hooks'
import { apiErrorMessage, apiFieldErrors } from '@/lib/axios'
import { nombreDelProducto } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { defaultRouteFor, useAuthStore } from '@/store/auth'

/** Lo mismo que exige el servidor, para no descubrirlo hasta después de enviar. */
const FORMA_DEL_USUARIO = /^[a-z0-9._-]{3,40}$/

const construirEsquema = (t: (clave: string) => string) =>
  z.object({
    business_name: z.string().trim().min(2, t('acceso.escribeNombreNegocio')).max(120),
    admin_full_name: z.string().trim().min(3, t('acceso.escribeTuNombreCompleto')).max(150),
    email: z.string().trim().toLowerCase().email(t('acceso.correoNoValido')),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, t('acceso.alMenos3'))
      .max(40, t('acceso.maximo40'))
      .regex(FORMA_DEL_USUARIO, t('acceso.soloMinusculas')),
    // Sin formato impuesto: hay lada, extensión y prefijo de país, y todos son
    // legítimos. Lo que sí se exige es que tenga dígitos suficientes para poder
    // marcarlo, que es la misma regla del servidor.
    phone: z
      .string()
      .trim()
      .refine((valor) => (valor.match(/\d/g) ?? []).length >= 8, t('acceso.telefonoConLada')),
    operation_size: z.enum(['1-10', '11-30', '31-50', '50+'], {
      errorMap: () => ({ message: t('acceso.eligeTamano') }),
    }),
    password: z.string().min(8, t('acceso.alMenos8')),
  })

type RegistroForm = z.infer<ReturnType<typeof construirEsquema>>

const CAMPOS = [
  'business_name',
  'admin_full_name',
  'email',
  'username',
  'phone',
  'operation_size',
  'password',
] as const

/** Las cuatro franjas con las que se perfila la operación.
 *
 *  Se preguntan aquí para no volver a preguntarlas en el asistente: de aquí
 *  sale la cifra que llega ya propuesta en el paso de habitaciones. */
const TAMANOS = [
  { valor: '1-10', etiqueta: 'acceso.tamano1a10' },
  { valor: '11-30', etiqueta: 'acceso.tamano11a30' },
  { valor: '31-50', etiqueta: 'acceso.tamano31a50' },
  { valor: '50+', etiqueta: 'acceso.tamanoMas50' },
] as const

/** Propuesta de clave a partir del correo, con la misma regla del servidor.
 *
 *  Es lo que este formulario hacía en silencio: derivaba la clave del correo y
 *  la persona la descubría después. Se sigue proponiendo -- ahorra teclear --
 *  pero a la vista y editable, que es la diferencia entre proponer e imponer. */
function usuarioDesdeCorreo(correo: string): string {
  const local = correo.split('@')[0] ?? ''
  return local
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40)
}

/** Los cuatro dominios que cubren casi todo el correo personal en México.
 *  No es autocompletado real -- eso pide una lista que nadie va a mantener --
 *  sino ahorrarse teclear la parte que siempre se escribe igual. */
const DOMINIOS = ['@gmail.com', '@outlook.com', '@hotmail.com', '@icloud.com']

/** El alta de autoservicio todavía no está abierta.
 *
 *  Se pone en una constante y no en un `if` suelto para que quitarla el día que
 *  el servidor esté listo sea borrar una línea y seguir sus usos. */
export const ALTA_CERRADA = true

/** Identifica un intento de alta ante el servidor.
 *
 *  `crypto.randomUUID` no existe sin HTTPS ni en navegadores viejos, y quien se
 *  registra puede llegar desde cualquiera; el respaldo basta porque la clave
 *  solo tiene que ser única mientras dura un formulario. */
function nuevaClaveDeIntento(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `alta-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Alta de autoservicio: cuatro campos y adentro.
 *
 *  Se piden los cuatro que no tienen valor por omisión posible. Zona horaria,
 *  moneda, tarifas y habitaciones se configuran en el asistente que aparece
 *  apenas entra: preguntarlos aquí alarga el formulario justo donde más gente
 *  lo abandona.
 */
export default function RegisterPage() {
  const { t } = useTranslation()
  const esquema = useMemo(() => construirEsquema(t), [t])
  const access = useAuthStore((state) => state.access)
  const user = useAuthStore((state) => state.user)
  const signup = useSignup()
  const [verClave, setVerClave] = useState(false)

  // El título no pasa por `useDocumentTitle`: ese lee la marca del negocio y
  // aquí todavía no hay negocio. Quien llega a darse de alta vería el nombre de
  // la sucursal que esta terminal visitó por última vez, que no es la suya.
  useEffect(() => {
    document.title = `${t('acceso.tituloPestanaAlta')} · ${nombreDelProducto()}`
  }, [t])

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    watch,
    formState: { errors },
  } = useForm<RegistroForm>({
    resolver: zodResolver(esquema),
    // Los errores aparecen al salir de cada campo y se corrigen mientras se
    // teclea. En un formulario de siete campos, guardarlos todos para el envío
    // es mandar a alguien a buscar cuál de los siete estaba mal.
    mode: 'onTouched',
    defaultValues: {
      business_name: '',
      admin_full_name: '',
      email: '',
      username: '',
      phone: '',
      password: '',
    },
  })

  // Una clave por intento de alta, no por clic. Mientras el usuario no
  // recargue la página, todos sus reintentos comparten clave y el servidor
  // devuelve la misma organización en vez de crear otra.
  const intentoRef = useRef(nuevaClaveDeIntento())
  const [inicioEspera, setInicioEspera] = useState(0)

  const correo = watch('email')
  const tamano = watch('operation_size')

  // Las sugerencias solo estorban una vez que el dominio ya está escrito: se
  // muestran mientras haya algo antes de la arroba y nada -- o poco -- después.
  const [local = '', dominio] = correo.split('@')
  const sugerirDominios = local.length > 0 && (dominio === undefined || !dominio.includes('.'))

  /* La clave se propone desde el correo mientras nadie la haya tocado.
   *
   *  En cuanto el usuario escribe la suya, este efecto se calla para siempre:
   *  una propuesta que se reimpone sobre lo tecleado deja de ser una ayuda. */
  const usuarioTocado = useRef(false)
  const propuesta = usuarioDesdeCorreo(correo)
  useEffect(() => {
    if (usuarioTocado.current || propuesta.length < 3) return
    setValue('username', propuesta, { shouldValidate: false })
  }, [propuesta, setValue])

  if (access) return <Navigate to={defaultRouteFor(user)} replace />

  // El alta todavía no está abierta del lado del servidor. Mientras tanto la
  // pantalla se enseña completa -- se puede teclear y ver la validación -- pero
  // no se manda nada: un formulario que acepta el envío y no crea la cuenta es
  // peor demo que uno que lo dice de frente.
  const onSubmit = handleSubmit((values) => {
    if (ALTA_CERRADA) return
    setInicioEspera(Date.now())
    return signup.mutate(
      { ...values, attempt_key: intentoRef.current },
      {
        onError: (error) => {
          // La API dice exactamente qué campo falló y por qué; hasta ahora todo
          // eso terminaba resumido en un banner que no decía cuál era el malo.
          const porCampo = apiFieldErrors(error)
          const conocidos = CAMPOS.filter((campo) => porCampo[campo])
          conocidos.forEach((campo, indice) =>
            setError(campo, { message: porCampo[campo] }, { shouldFocus: indice === 0 }),
          )
        },
      },
    )
  })

  // Si el error ya quedó pintado bajo su input, el banner solo repite.
  const errorGeneral =
    signup.isError && !CAMPOS.some((campo) => errors[campo])
      ? apiErrorMessage(signup.error, t('acceso.noSePudoCrearCuenta'))
      : null

  const completarDominio = (sufijo: string): void => {
    setValue('email', `${local}${sufijo}`, { shouldValidate: true, shouldDirty: true })
    setFocus('password')
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid-surface grid-fade pointer-events-none absolute inset-0" aria-hidden />

      {/* Más ancho que el acceso a propósito: siete campos en una sola columna
          son un formulario que se desplaza, y desplazarse es donde la gente
          abandona. En dos columnas cabe entero en una pantalla de escritorio. */}
      <div className="relative w-full max-w-[24rem] space-y-8 md:max-w-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
            <LuBuilding2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tightest">{t('acceso.creaTuCuenta')}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('acceso.daDeAltaTuNegocio')}
            </p>
          </div>

          {/* El alta todavía no está abierta y esta pantalla se enseña en demos:
              decirlo aquí arriba evita que alguien la llene y se quede esperando
              una cuenta que nadie va a crear. */}
          <div className="flex flex-col items-center gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-2xs font-medium uppercase tracking-wide text-foreground">
              {t('acceso.proximamente')}
            </span>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {t('acceso.altaEnPreparacion')}
            </p>
          </div>
        </div>

        {signup.isPending ? (
          // Acotada, aunque el formulario de atrás mida el doble. Sin esto la
          // espera hereda el ancho de las dos columnas y aparece como una caja
          // enorme con un punto girando en medio: el salto se lee como que algo
          // se rompió, justo en el segundo en que hay que dar confianza.
          <div className="mx-auto w-full max-w-[24rem]">
            <PreparandoEspacio desde={inicioEspera} onCancelar={() => signup.reset()} />
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-6">
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              {/* Dos columnas en escritorio, una en el teléfono. El orden de
                  tabulación sigue siendo el de lectura porque el grid coloca en
                  el mismo orden del marcado. */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="business_name">{t('acceso.nombreDelNegocio')}</Label>
                  <Input
                    id="business_name"
                    autoFocus
                    autoComplete="organization"
                    placeholder={t('acceso.ejemploNegocio')}
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
                  <Label htmlFor="admin_full_name">{t('acceso.tuNombre')}</Label>
                  <Input
                    id="admin_full_name"
                    autoComplete="name"
                    placeholder={t('acceso.ejemploNombre')}
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
                  <Label htmlFor="phone">{t('acceso.telefono')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="667 220 1188"
                    aria-invalid={Boolean(errors.phone)}
                    {...register('phone')}
                  />
                  {errors.phone ? (
                    <p role="alert" className="text-xs leading-relaxed text-destructive">
                      {errors.phone.message}
                    </p>
                  ) : (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t('acceso.paraAvisarte')}
                    </p>
                  )}
                </div>
              </div>

              {/* El correo y la clave, juntos: la segunda se propone desde el
                  primero, y verlos en la misma línea hace evidente de dónde
                  salió. Además ahorra un renglón, que es lo que sacaba el
                  botón de enviar fuera de la pantalla. */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('acceso.correo')}</Label>
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
                      {t('acceso.conEsteCorreo')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">{t('acceso.nombreDeUsuario')}</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="font-mono"
                    placeholder="laura.dominguez"
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby="username-ayuda"
                    {...register('username', {
                      onChange: () => {
                        usuarioTocado.current = true
                      },
                    })}
                  />
                  <p
                    id="username-ayuda"
                    role={errors.username ? 'alert' : undefined}
                    className={cn(
                      'text-xs leading-relaxed',
                      errors.username ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {errors.username ? errors.username.message : t('acceso.reglaUsuario')}
                  </p>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium leading-none">
                  {t('acceso.deQueTamano')}
                </legend>
                {/* Cuatro botones y no una lista desplegable: son pocas
                    opciones, caben todas a la vista y se contesta en un toque en
                    vez de en dos. */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TAMANOS.map((opcion) => (
                    <label
                      key={opcion.valor}
                      className={cn(
                        'flex cursor-pointer items-center justify-center rounded-md border px-2 py-2.5',
                        'text-center text-xs font-medium transition-colors duration-150',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                        tamano === opcion.valor
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:border-foreground/25 hover:bg-accent',
                      )}
                    >
                      <input
                        type="radio"
                        value={opcion.valor}
                        className="sr-only"
                        {...register('operation_size')}
                      />
                      {t(opcion.etiqueta)}
                    </label>
                  ))}
                </div>
                {errors.operation_size ? (
                  <p role="alert" className="text-xs leading-relaxed text-destructive">
                    {errors.operation_size.message}
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t('acceso.conEstoLlegas')}
                  </p>
                )}
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="password">{t('acceso.contrasena')}</Label>
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
                    aria-label={
                      verClave ? t('acceso.ocultarContrasena') : t('acceso.mostrarContrasena')
                    }
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

              <Button
                type="submit"
                className="h-11 w-full lg:h-10"
                disabled={ALTA_CERRADA}
                aria-describedby={ALTA_CERRADA ? 'alta-cerrada' : undefined}
              >
                {t('acceso.crearCuenta')}
              </Button>
              {ALTA_CERRADA ? (
                <p
                  id="alta-cerrada"
                  className="text-center text-xs leading-relaxed text-muted-foreground"
                >
                  {t('acceso.altaEnPreparacion')}
                </p>
              ) : null}
            </form>
          </div>
        )}

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <LuArrowLeft className="h-3 w-3" aria-hidden />
            {t('acceso.yaTengoCuenta')}
          </Link>
        </p>
      </div>
    </div>
  )
}
