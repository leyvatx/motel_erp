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
| Usuarios | ✅ Pantalla terminada con altas, edición, roles, bajas, reactivación y contraseñas | ✅ `UserViewSet` completo, `/auth/roles/`, `restore/`, `force-password-change/` |
| Reportes | `PlaceholderPage` en `routes.tsx:97` | ⚠️ Solo piezas sueltas: `rooms/summary` (foto del momento), `shifts/{id}/summary` (un turno), `expenses/totals`, `audit/summary`. **No existe nada histórico ni agregado** |

**Funcionalidad de backend sin ninguna interfaz:**

- **Reservaciones** — `Reservation` con folio, huésped, teléfono, placas, no-show automático por Celery. Hay endpoints y hasta `frontdesk/api.ts:73` los llama, pero no hay pantalla para crear ni gestionar reservas.
- **Tarifas dinámicas** — `TariffRule` y `Holiday` (`rooms/models.py:173,195`) con sus ViewSets. Cero UI, cero tipos en el frontend. Hoy los recargos de fin de semana o día festivo solo se pueden tocar por el admin de Django.
- **Perfil del usuario** — ✅ cambio de contraseña disponible desde el menú y obligatorio cuando gerencia lo solicita.
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
| 12 | Pantalla de Auditoría | **Terminada** |
| 13 | Pantalla de Usuarios | **Operativa** |
| 14 | Reportes (backend nuevo + pantalla) | **Terminada** |
| 15 | Dashboard por rol | **Operativo** |
| 16 | Reservaciones y tarifas dinámicas | **Terminada** |
| 17 | eslint, vitest, CI | **Operativa** |
| 18 | Proveedores, compras, recepciones y catálogos | **Terminada** |
| 19 | Personalización visual completa por motel | **Terminada** |

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

**Terminada.** Incluye resumen, tabla paginada, filtros por acción, módulo,
usuario, búsqueda y fechas, detalle antes/después, contexto técnico,
exportación CSV completa y enlaces desde el historial de una renta.

1. `features/audit/AuditPage.tsx`: tabla paginada con filtros de acción, módulo, actor, búsqueda y rango de fechas.
2. Panel de detalle con el diff `changes` (antes/después) legible, IP y user-agent.
3. Tiras de resumen arriba usando `/audit/logs/summary/`.
4. Enlace cruzado: desde `StayTimeline` y desde cualquier ficha, "ver en bitácora" con `?target=rooms.stay&object_id=N`.
5. Exportar el resultado filtrado a CSV.
6. Quitar el placeholder de `routes.tsx:105`.

### Fase 13 — Usuarios y perfil

**Operativa.** Incluye listado paginado, filtros, alta, edición, roles, baja
lógica, reactivación, contraseña inicial, cambio personal y cambio obligatorio.
Quedan como mejoras la matriz visual de permisos y el historial de sesiones.

1. `features/users/UsersPage.tsx`: alta, edición, cambio de rol, activar/desactivar, forzar cambio de contraseña. Solo SuperAdmin, como ya declara la matriz.
2. Vista de la matriz rol → permisos en modo lectura, generada desde `/auth/roles/`, para que se entienda quién puede qué.
3. Menú de perfil en el Topbar: cambiar mi contraseña, mis sesiones, cerrar sesión.
4. Integrar `TeamPresence` (ya existe) como pestaña de la sección.
5. Quitar el placeholder de `routes.tsx:123`.

### Fase 14 — Reportes (backend nuevo + pantalla)

**Terminada.** El backend agregado opera por motel, acepta periodos de hasta
367 días, limita el acceso a gerencia y exporta a CSV. El frontend consulta
cada reporte bajo demanda para evitar trabajo innecesario al servidor.

**Backend — nueva app `apps.reports`** (solo lectura, agregaciones, sin modelos propios):

| Endpoint | Devuelve |
| --- | --- |
| `GET /reports/occupancy/` | Ocupación por día/hora, rotación por habitación, estancia promedio |
| `GET /reports/revenue/` | Ingreso por día, turno, tipo de habitación y bloque tarifario |
| `GET /reports/products/` | Ranking de productos vendidos, margen, mermas |
| `GET /reports/shifts/` | Comparativo de turnos: diferencias de arqueo, gastos, ventas |
| `GET /reports/housekeeping/` | Tiempos de limpieza por camarista y por habitación |

Todos con `?from=&to=`, exigiendo `REPORT_VIEW`, y con `?format=csv` para exportar.

**Frontend terminado**

1. `features/reports/ReportsPage.tsx` con selector de periodo y pestañas por reporte.
2. Gráficas de líneas y barras (agregar `recharts`), más las tablas de respaldo.
3. Botón de exportar a CSV en cada reporte.
4. Quitar el placeholder de `routes.tsx:97`.

### Fase 15 — Dashboard por rol

**Operativo.** Es la nueva pantalla inicial y cambia según el rol. Consume los
endpoints operativos existentes para mostrar ocupación, rentas por vencer,
limpieza, mantenimiento, caja, gastos por aprobar y stock bajo. También incluye
alertas priorizadas, estados vacíos y accesos rápidos.

**Backend** — `GET /api/v1/reports/dashboard/` en la app nueva de reportes,
devolviendo solo lo que el rol puede ver:

| Quién entra | Qué ve |
| --- | --- |
| Recepción | Ocupación de ahora, rentas por vencer, su turno de caja, pendientes de limpieza |
| Gerencia | Lo anterior más ingreso del día contra el de ayer, gastos por aprobar, stock bajo, diferencias de arqueo |
| Ama de llaves | Sus cuartos pendientes, tiempos de limpieza, reportes de mantenimiento abiertos |
| Plataforma | Moteles activos, altas del mes, actividad por motel |

**Frontend terminado** — `features/dashboard/DashboardPage.tsx` es la ruta
inicial para los usuarios de motel. Cada bloque respeta el rol, así que un
empleado no consulta ni ve datos que no le corresponden.

Queda como mejora posterior sustituir las consultas operativas por el endpoint
agregado de reportes cuando exista, para añadir comparativos históricos sin
cargar esa lógica en el navegador.

### Fase 16 — Reservaciones y tarifas dinámicas

**Terminada.** Incluye alta y consulta por fechas, búsqueda, estados, asignación
opcional de habitación y tarifa, llegada convertida directamente en renta,
cancelación, no-show y avisos de próximas llegadas en Recepción y Dashboard.

Configuración incorpora precios especiales por días de semana, rangos de
fecha, horarios y festivos, junto con el precio base y vigente de cada bloque.

### Fase 17 — Calidad e infraestructura

**Operativa.** ESLint, Prettier y Vitest están configurados; CI valida backend
y frontend con PostgreSQL y Redis reales. Se versionaron ambos `.env.example`,
un comando `check_runtime` comprueba base de datos, Channels y broker, y el
script `scripts/load_smoke.py` mide concurrencia usando uno o varios moteles.

La ejecución local de la prueba integral sigue dependiendo de tener Docker
disponible en la máquina donde se despliegue.

### Fase 18 — Compras y abastecimiento

**Terminada.** Inventarios ahora administra proveedores, productos, categorías
y almacenes desde la interfaz. Las órdenes de compra tienen folio consecutivo
por motel, estados de borrador, enviada, parcial, recibida y cancelada, además
de fechas, referencia, impuestos y partidas.

La recepción puede hacerse por cantidades parciales. Cada renglón recibido
entra al almacén destino mediante el motor transaccional del Kardex, conserva
la orden como documento origen, actualiza costos y solicita lote/caducidad para
productos perecederos. Solo gerencia tiene `inventory.purchase`; recepción y
ama de llaves conservan consulta sin ver acciones administrativas.

### Fase 19 — Personalización por motel

**Terminada.** La identidad visual dejó de depender de una computadora. Cada
motel guarda paleta principal, menú lateral, colores de estados, tipografía,
redondeo, tema/densidad predeterminados y mensaje de acceso. El editor incluye
selectores libres de color y vista previa; el endpoint público entrega solo la
marca necesaria para personalizar el login.

Los cambios se propagan en tiempo real exclusivamente dentro del motel. Tema,
densidad y alertas sonoras pueden sobrescribirse en una terminal sin modificar
la marca compartida. Nombre, logo, moneda, zona horaria y datos de tickets
continúan en la misma fuente de verdad del servidor.

### Fase 20 — Administración corporativa

**Terminada.** Se incorporó la jerarquía grupo → región → motel, usuarios sin
propiedad fija con acceso explícito a varias regiones o moteles y selección
segura de la propiedad activa. El cambio de motel limpia la caché del cliente,
vuelve a acotar todas las consultas y reconecta WebSocket únicamente a los
grupos de la propiedad elegida.

El tablero corporativo con componentes shadcn consolida habitaciones,
ocupación e ingresos de las últimas 24 horas. Desde la misma pantalla se crean
grupos, regiones y usuarios corporativos, se asignan propiedades y se agregan
accesos regionales. La configuración masiva admite únicamente una lista blanca
de parámetros, valida todo el lote, muestra una vista previa y aplica el cambio
en una sola transacción.

Los permisos corporativos no convierten una cuenta en administradora global:
consultas, asignaciones, tablero y cambios masivos se intersectan siempre con
los moteles autorizados. También se corrigieron las claves únicas de tipos,
números de habitación y festivos para que sean únicas por motel, no en toda la
plataforma.

---

## 4. Orden sugerido

Usuarios y Auditoría primero: son casi puro frontend sobre backend terminado y
quitan dos de los tres placeholders. Después Reportes, que trae backend nuevo y
del que cuelga el Dashboard. Reservaciones y calidad se intercalan según lo que
apriete el negocio.
