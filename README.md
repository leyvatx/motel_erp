# Motel ERP

Sistema integral de administración para moteles: recepción con cronómetros,
inventario multialmacen, ama de llaves, finanzas por turno y auditoría.

Un mismo servidor atiende a varios moteles. Cada uno tiene sus habitaciones,
su inventario, su caja y su plantilla, y no ve nada de los demás: el motel es
dueño de cada registro y los managers acotan solas todas las consultas.

## Estructura

```
motel_erp/
├── api/         Backend Django 5 + DRF + Channels + Celery
├── frontend/    React 18 + Vite + TypeScript + Tailwind (Fase 7)
└── docker-compose.yml   PostgreSQL 16 + Redis 7
```

## Puesta en marcha del backend

1. Levantar servicios de infraestructura:

```bash
docker compose up -d
```

2. Crear entorno virtual e instalar dependencias:

```bash
python -m venv api/.venv && api/.venv/Scripts/activate && pip install -r api/requirements.txt
```

3. Crear `api/.env` con la configuración local. Nunca se versiona.

| Variable | Para qué sirve |
| --- | --- |
| `DJANGO_SECRET_KEY` | Llave de firma de Django. Única por instalación |
| `DJANGO_DEBUG` | `True` solo en desarrollo |
| `DJANGO_ALLOWED_HOSTS` | Hosts que atiende, separados por coma |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Orígenes confiables para CSRF |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `REDIS_URL` | Channel layer de Channels |
| `CELERY_BROKER_URL` | Broker de Celery |
| `CELERY_RESULT_BACKEND` | Backend de resultados de Celery |
| `CACHE_URL` | Caché compartida entre procesos |
| `CORS_ALLOWED_ORIGINS` | Orígenes del frontend |
| `JWT_ACCESS_TOKEN_MINUTES` | Vigencia del access token |
| `JWT_REFRESH_TOKEN_DAYS` | Vigencia del refresh token |
| `LOGIN_THROTTLE_RATE` | Intentos de acceso por IP y minuto |
| `REPORT_THROTTLE_RATE` | Consultas de reportes por minuto |
| `BUSINESS_TIME_ZONE` | Zona horaria del negocio |
| `BUSINESS_CURRENCY` | Moneda de los importes |
| `BUSINESS_NAME` | Nombre que sale en el ticket |
| `BUSINESS_ADDRESS` | Dirección que sale en el ticket |
| `TICKET_FOOTER` | Pie del ticket |
| `EXPIRATION_WARNING_MINUTES` | Antelación del aviso de renta por vencer |
| `EXPENSE_APPROVAL_THRESHOLD` | Monto a partir del cual un gasto requiere aprobación |
| `PRINTER_BACKEND` | `dummy`, `network`, `usb` o `file` |
| `PRINTER_HOST` / `PRINTER_PORT` | Impresora térmica en red |
| `PRINTER_USB_VENDOR_ID` / `PRINTER_USB_PRODUCT_ID` | Impresora térmica por USB |
| `SEED_DEMO_PASSWORD` | Contraseña de los usuarios de `seed_demo` |

Todas tienen un valor por defecto razonable para desarrollo en
`api/core/settings.py`, salvo `DJANGO_SECRET_KEY`: con `DJANGO_DEBUG=False` y
sin ella el servidor **se niega a arrancar**. Esa llave firma los JWT de todos
los moteles, así que un despliegue con la de ejemplo deja que cualquiera se
fabrique una sesión de cualquier propiedad. Se genera con:

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

Redis atiende tres cosas en bases distintas para que no se pisen: el channel
layer (`/0`), el broker de Celery (`/1`) y la caché (`/2`). La caché tiene que
ser compartida y no local al proceso: de ella dependen el límite de intentos de
acceso -- que si no se multiplica por el número de workers -- y la
configuración vigente de cada motel.

Las de negocio (`BUSINESS_NAME`, `BUSINESS_ADDRESS`, `TICKET_FOOTER`,
`BUSINESS_CURRENCY`, `BUSINESS_TIME_ZONE`, `EXPIRATION_WARNING_MINUTES`,
`EXPENSE_APPROVAL_THRESHOLD` y las de impresora) solo **siembran el primer
motel**. A partir de ahí manda la base de datos y se editan desde
Configuración -> Negocio, sin reiniciar nada. En una instalación ya migrada,
cambiar el `.env` no tiene efecto.

4. Migrar y crear el superusuario:

```bash
python api/manage.py migrate
```

```bash
python api/manage.py createsuperuser
```

Para probar el sistema con un motel de ejemplo (habitaciones, tarifas,
inventario, usuarios y algunas rentas activas):

```bash
python api/manage.py seed_demo
```

Crea los usuarios `admin`, `gerente`, `recepción` y `limpieza`, todos con la
contraseña `Demo.1234`.

5. Servidor ASGI (HTTP + WebSockets):

```bash
python api/manage.py runserver
```

6. Worker y scheduler de Celery (en terminales aparte):

```bash
celery -A core worker -l info -P solo
```

```bash
celery -A core beat -l info
```

## Puesta en marcha del frontend

```bash
cd frontend && npm install
```

```bash
npm run dev
```

Vite sirve en `http://localhost:5173` y hace proxy de `/api` y `/ws` hacía
`localhost:8000`, así que en desarrollo no hay CORS ni URLs cruzadas.

En desarrollo no hace falta configurar nada. Para apuntar a un backend en otro
host se crea `frontend/.env.local`, que tampoco se versiona:

| Variable | Para qué sirve |
| --- | --- |
| `VITE_API_URL` | URL de la API. Vacía usa el proxy de Vite |
| `VITE_WS_URL` | URL del WebSocket. Vacía usa el proxy de Vite |
| `VITE_ENABLE_SOUND_ALERTS` | Alertas sonoras del tablero de recepción |

| Comando | Que hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Verifica tipos (`tsc --noEmit`) y compila a `dist/` |
| `npm run typecheck` | Solo verificacion de tipos |
| `npm run lint` | Reglas estáticas de TypeScript y React |
| `npm test` | Pruebas frontend con Vitest |
| `npm run format` | Aplica formato con Prettier |

## Verificación de infraestructura

Con PostgreSQL y Redis levantados, este comando comprueba la base de datos,
el channel layer de WebSockets y el broker de Celery:

```bash
python api/manage.py check_runtime
```

Para una prueba HTTP concurrente se pasan uno o varios JWT de moteles. Los
tokens se reparten entre las peticiones para comprobar también el aislamiento:

```bash
MOTEL_ERP_TOKENS="token_motel_1,token_motel_2" python scripts/load_smoke.py
```

Se ajusta con `MOTEL_ERP_REQUESTS`, `MOTEL_ERP_CONCURRENCY`,
`MOTEL_ERP_BASE_URL` y `MOTEL_ERP_TIMEOUT`.

Cada push y pull request ejecuta automáticamente migraciones, pruebas Django,
lint, typecheck, pruebas frontend y build mediante GitHub Actions.

## Despliegue en producción

`docker-compose.prod.yml` levanta los nueve servicios que hacen falta:
PostgreSQL, Redis, la API bajo ASGI, el worker general y el worker de
impresión, el beat de Celery, nginx con la interfaz compilada, la renovación
del certificado y el respaldo periódico de la base.

La impresión corre en su propia cola (`printing`) y con su propio worker. Una
térmica apagada tarda diez segundos en fallar y reintenta tres veces; en la
cola general eso retrasaría el barrido de cronómetros, que corre cada treinta
segundos y es de donde recepción saca las cuentas regresivas. **Si actualizas
un despliegue anterior, el servicio `printer` tiene que quedar arriba o los
tickets se encolan y nadie los imprime.**

1. Copiar `api/.env.example` a `api/.env` y ajustarlo. Para producción cambian:

| Variable | Valor |
| --- | --- |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | Una llave propia. Sin ella el servidor no arranca |
| `DJANGO_ALLOWED_HOSTS` | El dominio real, separado por comas |
| `DJANGO_CSRF_TRUSTED_ORIGINS` / `CORS_ALLOWED_ORIGINS` | `https://tu-dominio` |
| `DATABASE_URL` | `postgres://usuario:clave@db:5432/motel_erp` |
| `REDIS_URL` / `CELERY_BROKER_URL` / `CACHE_URL` | `redis://redis:6379/0`, `/1` y `/2` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Los mismos de `DATABASE_URL` |

2. Levantar todo. El archivo de configuración se pasa explícitamente porque de
   ahí salen tanto las variables de Django como la contraseña de PostgreSQL:

```bash
docker compose --env-file api/.env -f docker-compose.prod.yml up -d --build
```

3. Crear la cuenta de plataforma, que es la que da de alta moteles:

```bash
docker compose -f docker-compose.prod.yml exec api python manage.py createsuperuser
```

Las migraciones y los archivos estáticos corren solos al arrancar el contenedor
de la API. El worker y el beat usan la misma imagen y se saltan ese paso para
no competir por la misma migración.

### TLS

nginx termina TLS. El puerto 80 solo contesta el reto de ACME y manda todo lo
demás a HTTPS. Hace falta que `CERT_DOMAIN` y `CERT_EMAIL` estén en `api/.env`
y que `CERT_DOMAIN` aparezca también en `DJANGO_ALLOWED_HOSTS`.

Al arrancar sin certificado, `deploy/bootstrap-cert.sh` genera uno autofirmado
para que nginx pueda levantar: sin él nginx no arranca, y sin nginx arriba
certbot no puede contestar el reto. El navegador va a rechazar ese provisional
—se espera— y dura lo que tardes en emitir el bueno, que se pide una sola vez
con el dominio ya apuntando al servidor:

```bash
docker compose --env-file api/.env -f docker-compose.prod.yml run --rm certbot-init
```

Después, recargar nginx para que tome el certificado nuevo:

```bash
docker compose -f docker-compose.prod.yml exec web nginx -s reload
```

De ahí en adelante el servicio `certbot` renueva cada doce horas y nginx se
recarga solo cada seis, así que la renovación entra en servicio sin reiniciar
nada. `deploy/certs/` guarda las llaves privadas y está en `.gitignore`.

Si prefieres terminar TLS en un balanceador de enfrente (Caddy, Traefik, el de
tu proveedor): borra el bloque `443` de `deploy/nginx.conf.template`, cambia
`$scheme` por `$http_x_forwarded_proto` y pon `DJANGO_SECURE_SSL_REDIRECT=False`
en `api/.env`.

## Despliegue en Render

`render.yaml` es un Blueprint: describe los seis servicios completos y Render
los crea de una sola vez. No hace falta nginx ni certbot, porque Render termina
TLS y entrega dominios `*.onrender.com` con HTTPS ya resuelto.

| Servicio | Tipo | Plan |
| --- | --- | --- |
| `motel-erp-db` | PostgreSQL administrado | gratuito |
| `motel-erp-redis` | Redis administrado | gratuito |
| `motel-erp-api` | Web (Docker, ASGI) | gratuito |
| `motel-erp-frontend` | Sitio estático | gratuito |

Render no ofrece plan gratuito para *background workers*, así que el blueprint
no los incluye: el despliegue completo cabe en el plan gratuito. Lo que queda
fuera mientras no haya workers son los cronómetros automáticos de vencimiento,
los avisos de stock bajo y la impresión. Recepción, caja, inventario, reportes,
auditoría y configuración funcionan igual, y el tiempo real de las acciones que
hace un usuario sigue llegando por WebSocket.

Para activarlos después se agregan al blueprint tres servicios `type: worker`
con `plan: starter`, la misma imagen de `api/Dockerfile`, `RUN_MIGRATIONS=0`,
`RUN_COLLECTSTATIC=0` y los comandos `celery -A core worker -Q celery`,
`celery -A core worker -Q printing -c 2` y `celery -A core beat`.

### Pasos

1. Sube la rama a GitHub.
2. En Render: **New → Blueprint**, conecta el repositorio y elige la rama.
3. Render pide dos valores que no puede adivinar porque dependen de la URL que
   te asigne al frontend. Se llenan después del primer despliegue, en el panel
   del servicio `motel-erp-api`:

   | Variable | Valor |
   | --- | --- |
   | `CORS_ALLOWED_ORIGINS` | el dominio del frontend |
   | `DJANGO_CSRF_TRUSTED_ORIGINS` | el mismo dominio |

   Basta el host pelón: el backend le antepone `https://` solo.

4. La cuenta de plataforma se crea sola. `createsuperuser` es interactivo y el
   plan gratuito de Render no da acceso a Shell, así que el arranque llama a
   `ensure_platform_admin`, que la crea a partir de dos variables si todavía no
   existe:

   | Variable | Valor |
   | --- | --- |
   | `PLATFORM_ADMIN_USERNAME` | la clave con la que vas a entrar |
   | `PLATFORM_ADMIN_PASSWORD` | mínimo ocho caracteres, no puede ser solo números |

   El comando es idempotente: si la cuenta ya existe no la toca ni le cambia la
   contraseña. Cambiar `PLATFORM_ADMIN_PASSWORD` después no reescribe nada, así
   que la contraseña se cambia desde la interfaz.

`DJANGO_SECRET_KEY` vive en el grupo de variables `motel-erp-comun`, no en cada
servicio. Tiene que ser la misma en todos: es la que firma los JWT, y si el
worker tuviera otra, los tokens que emite la API no valdrían nada.

### Lo que este despliegue todavía no resuelve

- El plan gratuito del servicio web se duerme sin tráfico. La primera visita
  después de un rato tarda cerca de un minuto en responder.
- El disco es efímero: los logotipos que suba cada motel desaparecen en el
  siguiente despliegue. Para conservarlos hace falta un disco persistente, que
  es de paga, o mover `MEDIA_ROOT` a almacenamiento externo.
- El plan gratuito de PostgreSQL caduca. Revisa la vigencia vigente en Render
  antes de cargar datos que te importen.
- La impresión térmica no funciona desde la nube por la misma razón de siempre:
  el servidor no alcanza la red local de cada motel. Por eso `PRINTER_BACKEND`
  viene en `dummy` y el ticket automático al cerrar folio queda apagado.

### Respaldos

El servicio `backup` saca un `pg_dump` comprimido al arrancar y luego cada 24 h,
y conserva `BACKUP_RETENTION_DAYS` días. Viven en el volumen `backups`.

```bash
docker compose -f docker-compose.prod.yml logs backup | tail -5
```

El nombre definitivo aparece solo si el volcado y la compresión terminaron
bien, y los respaldos viejos se podan únicamente después de uno exitoso: una
racha de fallas no borra el historial. **Un respaldo que nunca se restauró no
es un respaldo**, así que conviene probar esto al menos una vez:

```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U motel -d motel_erp < respaldo.sql
```

### Lo que este despliegue todavía no resuelve

- Corre en **un solo servidor**. La API se escala subiendo `--workers`, no
  replicando el contenedor: los logotipos viven en un volumen local y las
  migraciones corren al arrancar. Para varios servidores hay que mover
  `MEDIA_ROOT` a almacenamiento compartido y sacar las migraciones del arranque.
- Los respaldos se quedan en el mismo servidor. Copiarlos fuera es lo que los
  vuelve útiles el día que se pierda la máquina.
- No hay reporte de errores ni alertas: de una caída te enteras porque llaman.

## WebSockets

| Canal | Uso |
| --- | --- |
| `wss://host/ws/frontdesk/?ticket=<boleto>` | Grid de habitaciones, cronómetros, ordenes |
| `wss://host/ws/notifications/?ticket=<boleto>` | Campana del topbar |

El handshake de WebSocket no admite cabeceras, así que algo tiene que viajar en
el query string. Va un boleto de un solo uso, no el JWT: se pide con
`POST /api/v1/auth/ws-ticket/` usando la sesión normal, vive treinta segundos,
muere al canjearse y no sirve para hablarle a la API REST. El JWT por query
string ya no se acepta —acababa escrito en el `access_log` de nginx con media
hora de vida por delante— y nginx registra `/ws/` con un formato que omite los
argumentos. Los clientes que sí pueden mandar cabeceras (pruebas, scripts, el
futuro agente de impresión) siguen usando `Authorization: Bearer`.

Una conexión sin credencial válida se cierra con código `4401`. Cada mensaje
llega como `{"event": "...", "payload": {...}, "timestamp": "..."}`.

## Tareas periódicas (Celery beat)

Beat solo coordina el calendario: en cada ejecución despacha un trabajo
independiente por motel activo. Cada worker activa explícitamente ese motel,
aplica sus parámetros y publica únicamente en sus canales de tiempo real.

| Tarea | Frecuencia | Que hace |
| --- | --- | --- |
| `apps.rooms.tasks.sweep_stay_timers` | 30 s | Detecta rentas por vencer y vencidas, emite evento y notificación |
| `apps.rooms.tasks.expire_stale_reservations` | 10 min | Marca no-show y libera la habitación |
| `apps.inventory.tasks.check_low_stock` | 15 min | Alerta de stock mínimo con silencio de 6 h |
| `apps.inventory.tasks.check_expiring_lots` | diaria 07:00 | Alerta de lotes por caducar o caducados |

## Documentacion de la API

- Swagger UI: `http://localhost:8000/api/docs/`
- Redoc: `http://localhost:8000/api/redoc/`
- Esquema OpenAPI: `http://localhost:8000/api/schema/`

## Estado del desarrollo

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Arquitectura base backend: settings, modelos de users/rooms/inventory/sales | Completa |
| 2 | Services y API de recepción: rentar, folio, extender, cobrar | Completa |
| 3 | Channels + Celery: cronómetros vencidos, stock mínimo, eventos | Completa |
| 4 | Inventario (Kardex) y ama de llaves | Completa |
| 5 | Finanzas: turnos, cortes ciegos, gastos, tickets ESC/POS | Completa |
| 6 | Auditoría y matriz de permisos | Completa |
| 7 | Base del frontend | Completa |
| 8 | Layout y dashboard de recepción | Completa |
| 9 | Inventario, ama de llaves y finanzas en frontend | Completa |
| 10 | Identidad del negocio en el servidor: título, favicon, logotipo, moneda y zona horaria | Completa |
| 11 | Multi-motel: varios moteles en un sistema, con sus datos separados | Completa |
| 12 | Usuarios y perfil en frontend | Completa |
| 13 | Dashboard por rol en frontend | Completa |
| 14 | Auditoría en frontend | Completa |
| 15 | Reportes gerenciales | Completa |
| 16 | Reservaciones y tarifas dinámicas | Completa |
| 17 | Calidad, pruebas y CI | Completa |
| 18 | Proveedores, compras, recepciones y catálogos de inventario | Completa |
| 19 | Identidad visual y experiencia personalizable por motel | Completa |

El plan de las siguientes mejoras está en `ROADMAP.md`.

## Moteles y permisos

Quien administra la plataforma no pertenece a ningún motel: es el único que da
de alta moteles (`POST /api/v1/settings/motels/`, junto con su usuario dueño) y
el único que los ve todos. Dentro de un motel, el dueño (SuperAdmin) puede
todo salvo administrar la plataforma.

La cuenta de plataforma entra en `/platform`, donde ve el padrón paginado de
moteles. No puede abrir Recepción, Caja, Inventario ni ningún otro endpoint
operativo: toda vista nueva falla cerrada si no declara explícitamente que es
de alcance plataforma. Los procesos internos que realmente necesitan cruzar
clientes deben usar `common.tenancy.without_motel()` de forma visible.

La matriz rol -> permiso vive en `apps/users/constants.py` (`ROLE_PERMISSIONS`) y
es la única fuente de verdad. Cada vista declara qué exige cada acción:

```python
required_permissions = {
    "rent": [PermissionCode.ROOM_RENT],
    "cancel": [PermissionCode.ROOM_CANCEL],
    "write": [PermissionCode.CONFIG_MANAGE],
}
```

Resumen: recepción opera el día a día y su propia caja; ama de llaves solo su
tablero; todo lo que implique perdonar dinero (descuentos), ajustar inventario,
aprobar gastos, ver reportes o consultar la bitácora queda en gerencia; el alta
de usuarios es exclusiva de SuperAdmin.

La lectura también está acotada, no solo la escritura. Turnos, movimientos de
efectivo y gastos devuelven únicamente los del propio empleado: cuánto cuadró o
faltó en la caja del compañero es información de quien manda. Ama de llaves no
lee nada de dinero. El costo y el margen de cada producto -- en el catálogo,
en los lotes y en el Kardex -- solo los ve quien administra compras; el resto
ve el producto y su precio de venta, que es lo que necesita para cobrarlo.

La clave de empleado es única dentro de su motel, no en toda la plataforma:
cada propiedad puede tener su `recepcion` y su `caja1`. El acceso resuelve solo
a qué motel entra mientras la clave no se repita; cuando sí se repite, la
terminal manda el identificador del motel que ya usó la última vez y el
formulario pide escribirlo si el intento falla. Los folios siguen la misma
regla: el consecutivo es por motel y dos propiedades pueden emitir el mismo el
mismo día.

## Compras e inventario

Inventarios incorpora cuatro vistas: existencias, compras, proveedores y
catálogos. Gerencia puede crear productos, categorías, almacenes y proveedores;
generar una orden; enviarla; y recibirla total o parcialmente. Cada recepción
crea automáticamente entradas en el Kardex, actualiza costo promedio y exige
lote/caducidad cuando el producto lo necesita.

Las órdenes nunca se eliminan. Un borrador puede enviarse o cancelarse, una
orden enviada puede recibirse, y una recepción parcial permanece abierta hasta
completar sus partidas. Todo el flujo pertenece al motel activo y requiere el
permiso `inventory.purchase`.

## Personalización por motel

Cada propiedad conserva en el servidor su nombre, logotipo, paleta principal,
color del menú, colores operativos, tipografía, redondeo, tema y densidad
predeterminados, además del mensaje de bienvenida del acceso. La misma marca se
aplica al login, navegación, botones, estados de habitaciones, alertas y tablas.

Los cambios se publican por WebSocket únicamente a las terminales del motel
modificado. Cada computadora puede respetar los valores del motel o elegir su
propio tema y densidad; esas dos preferencias locales no alteran la identidad
compartida. No existe ningún nivel de membresía ni campo bloqueado.

## Administración corporativa

La ruta `/corporate` concentra grupos, regiones, propiedades, usuarios
multi-motel y un dashboard consolidado. Una cuenta corporativa inicia sin
propiedad activa; al seleccionar un motel, el navegador envía `X-Motel-Id` en
cada petición y el backend comprueba el acceso antes de construir el contexto
del tenant. El mismo identificador viaja en el handshake de WebSocket para que
las alertas sigan aisladas.

La configuración masiva se ejecuta en dos pasos: vista previa y aplicación.
Solo acepta campos operativos y de identidad previamente autorizados, rechaza
moteles fuera del alcance del usuario y bloquea las propiedades dentro de una
transacción. No hay membresías, planes ni campos de pago: las restricciones
son exclusivamente de seguridad y rol.

## Convenciones no negociables

- Todo movimiento de dinero, inventario o estado de cuarto va dentro de
  `transaction.atomic()` y bloquea la fila en disputa con `select_for_update()`.
- El estado de una habitación solo cambia por `apps.rooms.state_machine`.
- Prohibido `DELETE`: los modelos de negocio heredan de `common.models.BaseModel`
  y se dan de baja con `soft_delete()`.
- Fechas siempre en UTC en el backend; la conversion a hora local es del cliente.
- Ninguna lista de la API responde sin paginar.
- Todo registro de negocio pertenece a un motel y hereda el de quien lo crea.
  Las consultas se acotan solas: si algo necesita cruzar moteles, va explícito
  con `common.tenancy.without_motel()`.
- Prohibido cualquier comentario en el código. Si algo necesita explicación,
  va en el docstring del módulo o de la función.
