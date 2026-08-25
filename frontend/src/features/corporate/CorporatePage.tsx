import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PiBuildings, PiDoorOpen, PiTreeStructure, PiUsers } from 'react-icons/pi'
import { useNavigate } from 'react-router-dom'

import { PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { corporateApi } from './api'
import {
  useCorporateDashboard,
  useCorporateGroups,
  useCorporateMotels,
  useCorporateMutation,
  useCorporateRegions,
  useCorporateUsers,
} from './hooks'
import type { BulkPreview } from './types'
import { apiErrorMessage } from '@/lib/axios'
import { formatMoney } from '@/lib/format'
import { useAuthStore } from '@/store/auth'
import type { Role } from '@/types/api'

const selectClass =
  'h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof PiBuildings
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-5">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className="rounded-lg bg-muted p-2.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </span>
      </CardContent>
    </Card>
  )
}

export default function CorporatePage() {
  const dashboard = useCorporateDashboard()
  const motels = useCorporateMotels()
  const groups = useCorporateGroups()
  const regions = useCorporateRegions()
  const users = useCorporateUsers()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setActiveMotel = useAuthStore((state) => state.setActiveMotel)
  const activeMotelId = useAuthStore((state) => state.activeMotelId)
  const isPlatform = useAuthStore((state) => Boolean(state.user?.is_platform_admin))

  const [groupForm, setGroupForm] = useState({ code: '', name: '' })
  const [regionForm, setRegionForm] = useState({ group: '', code: '', name: '' })
  const [userForm, setUserForm] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'MANAGER' as Role,
    region: '',
  })
  const [accessForm, setAccessForm] = useState({ user: '', region: '', role: 'MANAGER' as Role })
  const [bulkForm, setBulkForm] = useState({
    region: '',
    brand_primary_color: '#3B82F6',
    default_theme: 'light',
    currency: 'MXN',
    time_zone: 'America/Mexico_City',
  })
  const [preview, setPreview] = useState<BulkPreview | null>(null)
  const [assignmentRegion, setAssignmentRegion] = useState('')
  const [assignedIds, setAssignedIds] = useState<number[]>([])

  const createGroup = useCorporateMutation(corporateApi.createGroup, 'Grupo creado')
  const createRegion = useCorporateMutation(corporateApi.createRegion, 'Región creada')
  const createUser = useCorporateMutation(corporateApi.createUser, 'Usuario corporativo creado')
  const createAccess = useCorporateMutation(corporateApi.createAccess, 'Acceso asignado')
  const assignMotels = useCorporateMutation(
    (body: { region: number; motel_ids: number[] }) =>
      corporateApi.assignRegionMotels(body.region, body.motel_ids),
    'Propiedades de la región actualizadas',
  )
  const bulk = useMutation({
    mutationFn: corporateApi.bulkConfig,
    onSuccess: (data) => {
      setPreview(data)
      if (data.applied) {
        toast.success('Configuración aplicada', `${data.target_count} moteles actualizados.`)
        void queryClient.invalidateQueries({ queryKey: ['corporate'] })
      }
    },
    onError: (error) => toast.error('No se pudo procesar', apiErrorMessage(error)),
  })

  const openMotel = (id: number, name: string, role: Role) => {
    setActiveMotel(id, name, role)
    queryClient.clear()
    navigate('/dashboard')
  }

  const bulkPayload = (dry_run: boolean) => ({
    region_id: Number(bulkForm.region),
    dry_run,
    changes: {
      brand_primary_color: bulkForm.brand_primary_color,
      default_theme: bulkForm.default_theme,
      currency: bulkForm.currency,
      time_zone: bulkForm.time_zone,
    },
  })

  const totals = dashboard.data?.totals
  return (
    <PageShell
      title="Administración corporativa"
      description="Control consolidado de grupos, regiones y propiedades desde un solo lugar."
    >
      <Tabs defaultValue="overview" className="min-h-0 flex-1 overflow-auto">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="structure">Grupos y regiones</TabsTrigger>
          <TabsTrigger value="team">Equipo y accesos</TabsTrigger>
          <TabsTrigger value="bulk">Configuración masiva</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Moteles visibles" value={totals?.motels ?? '—'} icon={PiBuildings} />
            <MetricCard label="Habitaciones" value={totals?.rooms ?? '—'} icon={PiDoorOpen} />
            <MetricCard label="Ocupadas ahora" value={totals?.occupied ?? '—'} icon={PiBuildings} />
            <MetricCard
              label="Ingresos últimas 24 h"
              value={formatMoney(totals?.revenue_24h)}
              icon={PiTreeStructure}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Operación por motel</CardTitle>
              <CardDescription>
                Selecciona una propiedad para entrar a su operación sin cerrar sesión.
              </CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Región</TableHead>
                  <TableHead>Habitaciones</TableHead>
                  <TableHead>Ocupación</TableHead>
                  <TableHead>Ingresos 24 h</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.data?.motels.length ? (
                  dashboard.data.motels.map((row) => {
                    const context = motels.data?.find((item) => item.id === row.motel_id)
                    return (
                      <TableRow
                        key={row.motel_id}
                        data-state={activeMotelId === row.motel_id ? 'selected' : undefined}
                      >
                        <TableCell>
                          <p className="font-medium">{row.motel_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.group_name ?? 'Sin grupo'}
                          </p>
                        </TableCell>
                        <TableCell>{row.region_name ?? 'Sin región'}</TableCell>
                        <TableCell>{row.rooms}</TableCell>
                        <TableCell>
                          <Badge variant={row.occupancy_rate >= 80 ? 'occupied' : 'secondary'}>
                            {row.occupancy_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell>{formatMoney(row.revenue_24h)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={!context || isPlatform}
                            title={
                              isPlatform
                                ? 'Crea un usuario corporativo para operar propiedades.'
                                : undefined
                            }
                            onClick={() =>
                              context && openMotel(context.id, context.name, context.access_role)
                            }
                          >
                            {isPlatform ? 'Solo consulta' : 'Entrar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableEmpty
                    colSpan={6}
                    message={
                      dashboard.isLoading
                        ? 'Cargando operación…'
                        : 'No hay moteles dentro de tu alcance.'
                    }
                  />
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="structure" className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Grupos</CardTitle>
              <CardDescription>Cadenas o razones operativas principales.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault()
                  createGroup.mutate(groupForm, {
                    onSuccess: () => setGroupForm({ code: '', name: '' }),
                  })
                }}
              >
                <Input
                  placeholder="Clave"
                  value={groupForm.code}
                  onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })}
                  required
                />
                <Input
                  placeholder="Nombre del grupo"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  required
                />
                <Button type="submit" disabled={createGroup.isPending}>
                  Agregar
                </Button>
              </form>
              <div className="divide-y rounded-md border">
                {groups.data?.results.map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.code}</p>
                    </div>
                    <Badge variant="secondary">{group.motel_count} moteles</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Regiones</CardTitle>
              <CardDescription>
                Agrupa propiedades para supervisión y cambios masivos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-2 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  createRegion.mutate(
                    {
                      group: Number(regionForm.group),
                      code: regionForm.code,
                      name: regionForm.name,
                    },
                    { onSuccess: () => setRegionForm({ group: '', code: '', name: '' }) },
                  )
                }}
              >
                <select
                  className={selectClass}
                  value={regionForm.group}
                  onChange={(e) => setRegionForm({ ...regionForm, group: e.target.value })}
                  required
                >
                  <option value="">Selecciona grupo</option>
                  {groups.data?.results.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Clave"
                  value={regionForm.code}
                  onChange={(e) => setRegionForm({ ...regionForm, code: e.target.value })}
                  required
                />
                <Input
                  placeholder="Nombre de la región"
                  value={regionForm.name}
                  onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })}
                  required
                />
                <Button type="submit" disabled={createRegion.isPending}>
                  Agregar región
                </Button>
              </form>
              <div className="divide-y rounded-md border">
                {regions.data?.results.map((region) => (
                  <div key={region.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">{region.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {region.group_name} · {region.code}
                      </p>
                    </div>
                    <Badge variant="secondary">{region.motel_count} moteles</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Asignar propiedades a una región</CardTitle>
              <CardDescription>
                Cada motel pertenece a una sola región; al moverlo se actualiza automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                className={selectClass}
                value={assignmentRegion}
                onChange={(e) => {
                  const value = e.target.value
                  setAssignmentRegion(value)
                  setAssignedIds(
                    motels.data
                      ?.filter((motel) => motel.region_id === Number(value))
                      .map((motel) => motel.id) ?? [],
                  )
                }}
              >
                <option value="">Selecciona región</option>
                {regions.data?.results.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.group_name} / {region.name}
                  </option>
                ))}
              </select>
              {assignmentRegion ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {motels.data?.map((motel) => (
                    <label
                      key={motel.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={assignedIds.includes(motel.id)}
                        onChange={(e) =>
                          setAssignedIds(
                            e.target.checked
                              ? [...assignedIds, motel.id]
                              : assignedIds.filter((id) => id !== motel.id),
                          )
                        }
                      />
                      <span>
                        <span className="block font-medium">{motel.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {motel.region_name ?? 'Sin región'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
              <Button
                disabled={!assignmentRegion || assignMotels.isPending}
                onClick={() =>
                  assignMotels.mutate({ region: Number(assignmentRegion), motel_ids: assignedIds })
                }
              >
                Guardar asignación
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Nuevo usuario corporativo</CardTitle>
              <CardDescription>
                Una sola cuenta puede trabajar con varias propiedades.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  createUser.mutate(
                    { ...userForm, region: Number(userForm.region), access_role: userForm.role },
                    {
                      onSuccess: () =>
                        setUserForm({
                          username: '',
                          full_name: '',
                          password: '',
                          role: 'MANAGER',
                          region: '',
                        }),
                    },
                  )
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Usuario"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Nombre completo"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="password"
                    minLength={8}
                    placeholder="Contraseña inicial"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    required
                  />
                  <select
                    className={selectClass}
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
                  >
                    <option value="MANAGER">Gerencia corporativa</option>
                    <option value="RECEPTION">Operación</option>
                    <option value="HOUSEKEEPING">Ama de llaves</option>
                  </select>
                </div>
                <select
                  className={selectClass}
                  value={userForm.region}
                  onChange={(e) => setUserForm({ ...userForm, region: e.target.value })}
                  required
                >
                  <option value="">Región inicial</option>
                  {regions.data?.results.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.group_name} / {region.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={createUser.isPending}>
                  Crear usuario
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Asignar acceso regional</CardTitle>
              <CardDescription>
                El usuario verá automáticamente todos los moteles vigentes de la región.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  createAccess.mutate(
                    {
                      user: Number(accessForm.user),
                      region: Number(accessForm.region),
                      role: accessForm.role,
                    },
                    { onSuccess: () => setAccessForm({ user: '', region: '', role: 'MANAGER' }) },
                  )
                }}
              >
                <select
                  className={selectClass}
                  value={accessForm.user}
                  onChange={(e) => setAccessForm({ ...accessForm, user: e.target.value })}
                  required
                >
                  <option value="">Selecciona usuario</option>
                  {users.data?.results.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.username})
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={accessForm.region}
                  onChange={(e) => setAccessForm({ ...accessForm, region: e.target.value })}
                  required
                >
                  <option value="">Selecciona región</option>
                  {regions.data?.results.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.group_name} / {region.name}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={accessForm.role}
                  onChange={(e) => setAccessForm({ ...accessForm, role: e.target.value as Role })}
                >
                  <option value="MANAGER">Gerente</option>
                  <option value="RECEPTION">Recepción</option>
                  <option value="HOUSEKEEPING">Ama de llaves</option>
                </select>
                <Button type="submit" disabled={createAccess.isPending}>
                  Asignar región
                </Button>
              </form>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PiUsers className="h-4 w-4" />
                {users.data?.count ?? 0} usuarios corporativos
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Configuración masiva</CardTitle>
              <CardDescription>
                Previsualiza el alcance antes de aplicar los mismos parámetros a una región
                completa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Región destino</Label>
                <select
                  className={selectClass}
                  value={bulkForm.region}
                  onChange={(e) => {
                    setBulkForm({ ...bulkForm, region: e.target.value })
                    setPreview(null)
                  }}
                >
                  <option value="">Selecciona región</option>
                  {regions.data?.results.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.group_name} / {region.name} ({region.motel_count})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Color principal</Label>
                  <Input
                    type="color"
                    value={bulkForm.brand_primary_color}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, brand_primary_color: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <select
                    className={selectClass}
                    value={bulkForm.default_theme}
                    onChange={(e) => setBulkForm({ ...bulkForm, default_theme: e.target.value })}
                  >
                    <option value="light">Claro</option>
                    <option value="dark">Oscuro</option>
                    <option value="system">Del sistema</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Input
                    maxLength={3}
                    value={bulkForm.currency}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, currency: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zona horaria</Label>
                  <Input
                    value={bulkForm.time_zone}
                    onChange={(e) => setBulkForm({ ...bulkForm, time_zone: e.target.value })}
                  />
                </div>
              </div>
              {preview ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="font-medium">
                    {preview.target_count} propiedades serán actualizadas
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {preview.targets.map((target) => target.name).join(', ') ||
                      'La región no contiene moteles.'}
                  </p>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!bulkForm.region || bulk.isPending}
                  onClick={() => bulk.mutate(bulkPayload(true))}
                >
                  Vista previa
                </Button>
                <Button
                  disabled={!preview || preview.target_count === 0 || bulk.isPending}
                  onClick={() => bulk.mutate(bulkPayload(false))}
                >
                  Aplicar a {preview?.target_count ?? 0} moteles
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
