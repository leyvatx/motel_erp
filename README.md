# Motel ERP

Sistema integral de administración para motel: recepción con cronómetros,
inventario multialmacen, ama de llaves, finanzas por turno y auditoría.

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

## WebSockets

| Canal | Uso |
| --- | --- |
| `ws://host/ws/frontdesk/?token=<access>` | Grid de habitaciones, cronómetros, ordenes |
| `ws://host/ws/notifications/?token=<access>` | Campana del topbar |

El token JWT viaja en el query string porque el handshake de WebSocket no
admite cabeceras. Una conexión sin token válido se cierra con código `4401`.
Cada mensaje llega como `{"event": "...", "payload": {...}, "timestamp": "..."}`.

## Tareas periódicas (Celery beat)

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

## Permisos

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

## Convenciones no negociables

- Todo movimiento de dinero, inventario o estado de cuarto va dentro de
  `transaction.atomic()` y bloquea la fila en disputa con `select_for_update()`.
- El estado de una habitación solo cambia por `apps.rooms.state_machine`.
- Prohibido `DELETE`: los modelos de negocio heredan de `common.models.BaseModel`
  y se dan de baja con `soft_delete()`.
- Fechas siempre en UTC en el backend; la conversion a hora local es del cliente.
- Ninguna lista de la API responde sin paginar.
