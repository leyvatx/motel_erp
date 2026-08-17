# Motel ERP — Diagnóstico y plan para cerrar el sistema

Revisión del 2026-08-16 sobre `68135af`. El backend está mucho más completo que el
frontend: hay endpoints listos que ninguna pantalla consume todavía, y la
personalización vive a medias entre el navegador y el `.env` del servidor.

---

## 1. Diagnóstico inicial

Foto del proyecto antes de empezar. Lo que ya se resolvió está marcado en el
estado actual, más abajo.

### 1.1 Personalización e identidad (lo que se ve roto hoy)

| # | Hallazgo | Dónde |
| --- | --- | --- |
| P1 | El título de la pestaña está clavado en `<title>Motel ERP</title>`. Nadie escribe `document.title`, por eso cambiar el nombre solo mueve el sidebar y el login | `frontend/index.html:7` |
| P2 | No hay favicon ni carpeta `public/`: el navegador muestra el icono genérico y no hay forma de poner el del motel | `frontend/` |
| P3 | Nombre, logotipo, tema y acento se guardan en `localStorage` (`motel-erp-appearance`). Son **por equipo**: la compu de recepción y la de gerencia pueden llamarse distinto, y todo se pierde al limpiar el navegador | `frontend/src/store/appearance.ts:42` |
| P4 | El backend tiene su **propia** identidad, separada y solo editable por `.env` + reinicio: `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `TICKET_FOOTER`, `BUSINESS_CURRENCY`, `BUSINESS_TIME_ZONE` | `api/core/settings.py:161,316-318` |
| P5 | Consecuencia directa de P3+P4: el ticket impreso puede decir un nombre y la pantalla otro. No hay una sola fuente de verdad de la marca | — |
| P6 | `formatMoney` está clavado a `es-MX` / `MXN` aunque exista `BUSINESS_CURRENCY` | `frontend/src/lib/format.ts:6` |
| P7 | Parámetros de operación que un gerente debería poder tocar solo se cambian por `.env`: `EXPIRATION_WARNING_MINUTES`, `EXPENSE_APPROVAL_THRESHOLD`, `PRINTER_BACKEND` y su host/puerto | `api/core/settings.py` |
| P8 | Las alertas sonoras dependen de `VITE_ENABLE_SOUND_ALERTS`, que es de **tiempo de compilación**: no se pueden silenciar desde la UI | `frontend/.env.local` |
| P9 | Apariencia corta: 6 acentos fijos, sin densidad de tabla, sin tamaño de fuente, sin distinguir preferencia **del usuario** (tema) de identidad **del negocio** (nombre/logo) | `AppearanceSettings.tsx` |
| P10 | El logotipo no llega al ticket ESC/POS ni al PDF de corte | `api/apps/sales/printing.py` |

### 1.2 Módulos incompletos

**Pantallas que son un placeholder aunque el backend ya esté listo:**

| Sección | Estado frontend | Backend disponible |
| --- | --- | --- |
| Auditoría | `PlaceholderPage` en `routes.tsx:105`, pero `features/audit/api.ts` ya tiene el hook y los tipos | ✅ `GET /audit/logs/` con filtros por acción, módulo, actor, rango de fechas, `target`+`object_id`, y `/audit/logs/summary/` |
| Usuarios | `PlaceholderPage` en `routes.tsx:123` | ✅ `UserViewSet` completo, `/auth/roles/`, `/auth/users/{id}/activate/`, `force-password-change/` |
| Reportes | `PlaceholderPage` en `routes.tsx:97` | ⚠️ Solo piezas sueltas: `rooms/summary` (foto del momento), `shifts/{id}/summary` (un turno), `expenses/totals`, `audit/summary`. **No existe nada histórico ni agregado** |

**Funcionalidad de backend sin ninguna interfaz:**

- **Reservaciones** — `Reservation` con folio, huésped, teléfono, placas, no-show automático por Celery. Hay endpoints y hasta `frontdesk/api.ts:73` los llama, pero no hay pantalla para crear ni gestionar reservas.
- **Tarifas dinámicas** — `TariffRule` y `Holiday` (`rooms/models.py:173,195`) con sus ViewSets. Cero UI, cero tipos en el frontend. Hoy los recargos de fin de semana o día festivo solo se pueden tocar por el admin de Django.
- **Perfil del usuario** — `POST /auth/change-password/` existe; ningún usuario puede cambiar su contraseña desde la app.
- **Reimpresión y tickets** — `print-ticket` y `print-report` existen; la UI los expone solo parcialmente.

### 1.3 Calidad e infraestructura

- `npm run lint` está declarado en `package.json` pero **eslint no está instalado ni configurado**: el script truena.
- **Cero pruebas de frontend** (no hay vitest ni testing-library). El backend sí trae 100 pruebas repartidas en 7 apps.
- **Sin CI**: no hay `.github/`. Nada corre `migrate --check`, pruebas ni `tsc` automáticamente.
- No hay `api/.env.example` ni `frontend/.env.example` versionados; la tabla del README es la única referencia.
- Redis no está instalado en este equipo, así que Channels y Celery no se pueden probar en local (tiempo real y tareas periódicas quedan sin verificar).
- El README declara "Fases 1–9 completas" cuando tres secciones son placeholder: el estado publicado no coincide con el real.

---

## 2. Estado actual

| Fase | Contenido | Estado |
| --- | --- | --- |
| 10 | Identidad del negocio en el servidor: título de pestaña, favicon, logotipo compartido, moneda y zona horaria configurables | **Terminada** |
| — | Cero comentarios en todo el proyecto (175 archivos) | **Terminada** |
| 11 | Multi-motel: un sistema, varios moteles con sus datos separados | **Terminada** |
| 12 | Pantalla de Usuarios | Pendiente |
| 13 | Pantalla de Auditoría | Pendiente |
| 14 | Reportes (backend nuevo + pantalla) | Pendiente |
| 15 | Dashboard por rol | Pendiente |
| 16 | Reservaciones y tarifas dinámicas | Pendiente |
| 17 | eslint, vitest, CI | Pendiente |

### Cómo quedó el multi-motel

- `settings.Motel` es la raíz: cada habitación, turno, folio, movimiento de
  inventario y usuario cuelga de un renglón de esa tabla.
- El motel viaja en el contexto de la petición (`common/tenancy.py`), no
  parámetro por parámetro, y los managers de `common/managers.py` acotan solos
  cada consulta. Un registro nuevo hereda el motel de quien lo crea.
- Los folios se numeran por motel: dos moteles pueden emitir el mismo
  consecutivo el mismo día sin pisarse.
- La plataforma (usuario sin motel asignado) da de alta moteles junto con su
  dueño; el dueño de un motel **no** puede administrar la plataforma, para que
  no vea a la competencia.
- Sin sesión no se sabe qué motel es, así que la terminal recuerda el
  identificador del último motel y con eso la pantalla de acceso muestra su
  nombre y logotipo.

## 3. Plan de lo que falta

Ordenado por valor sobre esfuerzo. Cada fase es un commit coherente y deja el
sistema utilizable.

### Fase 12 — Pantalla de Auditoría

La más barata: el `api.ts` ya existe y el backend está terminado.

1. `features/audit/AuditPage.tsx`: tabla paginada con filtros de acción, módulo, actor, búsqueda y rango de fechas.
2. Panel de detalle con el diff `changes` (antes/después) legible, IP y user-agent.
3. Tiras de resumen arriba usando `/audit/logs/summary/`.
4. Enlace cruzado: desde `StayTimeline` y desde cualquier ficha, "ver en bitácora" con `?target=rooms.stay&object_id=N`.
5. Exportar el resultado filtrado a CSV.
6. Quitar el placeholder de `routes.tsx:105`.

### Fase 13 — Usuarios y perfil

1. `features/users/UsersPage.tsx`: alta, edición, cambio de rol, activar/desactivar, forzar cambio de contraseña. Solo SuperAdmin, como ya declara la matriz.
2. Vista de la matriz rol → permisos en modo lectura, generada desde `/auth/roles/`, para que se entienda quién puede qué.
3. Menú de perfil en el Topbar: cambiar mi contraseña, mis sesiones, cerrar sesión.
4. Integrar `TeamPresence` (ya existe) como pestaña de la sección.
5. Quitar el placeholder de `routes.tsx:123`.

### Fase 14 — Reportes (backend nuevo + pantalla)

Es la fase más grande porque el backend agregado **no existe**.

**Backend — nueva app `apps.reports`** (solo lectura, agregaciones, sin modelos propios):

| Endpoint | Devuelve |
| --- | --- |
| `GET /reports/occupancy/` | Ocupación por día/hora, rotación por habitación, estancia promedio |
| `GET /reports/revenue/` | Ingreso por día, turno, tipo de habitación y bloque tarifario |
| `GET /reports/products/` | Ranking de productos vendidos, margen, mermas |
| `GET /reports/shifts/` | Comparativo de turnos: diferencias de arqueo, gastos, ventas |
| `GET /reports/housekeeping/` | Tiempos de limpieza por camarista y por habitación |

Todos con `?from=&to=`, exigiendo `REPORT_VIEW`, y con `?format=csv` para exportar.

**Frontend**

1. `features/reports/ReportsPage.tsx` con selector de periodo y pestañas por reporte.
2. Gráficas de líneas y barras (agregar `recharts`), más las tablas de respaldo.
3. Botón de exportar a CSV en cada reporte.
4. Quitar el placeholder de `routes.tsx:97`.

### Fase 15 — Dashboard por rol

Lo primero que se ve al entrar, y distinto según quién entra.

**Backend** — `GET /api/v1/reports/dashboard/` en la app nueva de reportes,
devolviendo solo lo que el rol puede ver:

| Quién entra | Qué ve |
| --- | --- |
| Recepción | Ocupación de ahora, rentas por vencer, su turno de caja, pendientes de limpieza |
| Gerencia | Lo anterior más ingreso del día contra el de ayer, gastos por aprobar, stock bajo, diferencias de arqueo |
| Ama de llaves | Sus cuartos pendientes, tiempos de limpieza, reportes de mantenimiento abiertos |
| Plataforma | Moteles activos, altas del mes, actividad por motel |

**Frontend** — `features/dashboard/DashboardPage.tsx` como nueva ruta inicial
(hoy `/` manda a recepción): tiras de indicadores, gráfica del día y accesos
rápidos a lo que está pendiente. Cada bloque se arma desde la matriz de
permisos, así que un empleado no ve tarjetas vacías de cosas que no le tocan.

### Fase 16 — Reservaciones y tarifas dinámicas

1. Pantalla de reservaciones: crear (huésped, teléfono, placas, llegada estimada), lista del día, convertir en renta, cancelar, marcar no-show.
2. Aviso de reservas próximas en el tablero de recepción.
3. Pestaña "Reglas de tarifa" en Configuración: recargos por día de la semana, franja horaria y días festivos (`TariffRule`), con vista previa de "cuánto costaría hoy a esta hora".
4. Pestaña "Días festivos" (`Holiday`) con alta rápida y calendario del año.

### Fase 17 — Calidad e infraestructura

1. Instalar y configurar eslint + prettier para que `npm run lint` sirva (hoy truena).
2. Vitest + Testing Library, con pruebas de las piezas que más duelen si se rompen: cálculo de cronómetros, `formatMoney`, arqueo ciego, guardas de permisos.
3. `.github/workflows/ci.yml`: backend (`migrate --check` + `manage.py test`) y frontend (`typecheck`, `lint`, `build`).
4. Versionar `api/.env.example` y `frontend/.env.example`.
5. Actualizar el README: estado real de fases y la nota de que la identidad ya no se configura por `.env`.
6. Verificar tiempo real: instalar Redis (o levantar el `docker-compose.yml` que ya existe) y probar Channels y Celery beat de punta a punta.

---

## 4. Orden sugerido

Usuarios y Auditoría primero: son casi puro frontend sobre backend terminado y
quitan dos de los tres placeholders. Después Reportes, que trae backend nuevo y
del que cuelga el Dashboard. Reservaciones y calidad se intercalan según lo que
apriete el negocio.
