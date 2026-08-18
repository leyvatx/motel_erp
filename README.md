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
| `CORS_ALLOWED_ORIGINS` | Orígenes del frontend |
| `JWT_ACCESS_TOKEN_MINUTES` | Vigencia del access token |
| `JWT_REFRESH_TOKEN_DAYS` | Vigencia del refresh token |
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
`api/core/settings.py`, salvo `DJANGO_SECRET_KEY` en producción.

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

## WebSockets

| Canal | Uso |
| --- | --- |
| `ws://host/ws/frontdesk/?token=<access>` | Grid de habitaciones, cronómetros, ordenes |
| `ws://host/ws/notifications/?token=<access>` | Campana del topbar |

El token JWT viaja en el query string porque el handshake de WebSocket no
admite cabeceras. Una conexión sin token válido se cierra con código `4401`.
Cada mensaje llega como `{"event": "...", "payload": {...}, "timestamp": "..."}`.

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
