import {
  PiBuildings,
  PiCalendar,
  PiClipboardText,
  PiGear,
  PiGridFour,
  PiPackage,
  PiScroll,
  PiShieldCheck,
  PiSquaresFour,
  PiTreeStructure,
  PiUsers,
  PiWallet,
} from 'react-icons/pi'
import type { IconType } from 'react-icons'

export interface NavItem {
  section: string
  to: string
  label: string
  icon: IconType
}

export interface NavGroup {
  id: string
  label: string
  items: readonly NavItem[]
  collapsible?: boolean
}

/** Las secciones de Configuración viven en la URL para que el menú pueda
 *  apuntar a una pestaña concreta y para que un enlace de otra pantalla caiga
 *  donde debe en vez de en la primera. */
export const CONFIG_SECTIONS = [
  { value: 'negocio', label: 'Negocio' },
  { value: 'habitaciones', label: 'Habitaciones' },
  { value: 'tipos', label: 'Tipos' },
  { value: 'tarifas', label: 'Tarifas' },
  { value: 'precios', label: 'Precios especiales' },
  { value: 'apariencia', label: 'Apariencia' },
] as const

export type ConfigSection = (typeof CONFIG_SECTIONS)[number]['value']

export const DEFAULT_CONFIG_SECTION: ConfigSection = 'negocio'

export function configPath(section: ConfigSection): string {
  return `/config?seccion=${section}`
}

export function isConfigSection(value: string | null): value is ConfigSection {
  return CONFIG_SECTIONS.some((section) => section.value === value)
}

/** Operación es lo que se hace todos los días; Gestión es lo que se consulta o
 *  se configura. Recepción vende productos y cierra su turno a diario, así que
 *  Inventarios y Caja son operación, no administración. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'platform',
    label: 'Plataforma',
    items: [
      { section: 'platform', to: '/platform', label: 'Sucursales', icon: PiBuildings },
      { section: 'corporate', to: '/corporate', label: 'Corporativo', icon: PiTreeStructure },
    ],
  },
  {
    id: 'daily',
    label: 'Operación',
    items: [
      { section: 'dashboard', to: '/dashboard', label: 'Inicio', icon: PiSquaresFour },
      { section: 'frontdesk', to: '/frontdesk', label: 'Recepción', icon: PiGridFour },
      { section: 'reservations', to: '/reservations', label: 'Reservaciones', icon: PiCalendar },
      {
        section: 'housekeeping',
        to: '/housekeeping',
        label: 'Ama de llaves',
        icon: PiClipboardText,
      },
      { section: 'inventory', to: '/inventory', label: 'Inventarios', icon: PiPackage },
      { section: 'finances', to: '/finances', label: 'Caja', icon: PiWallet },
    ],
  },
  {
    id: 'management',
    label: 'Gestión',
    collapsible: true,
    items: [
      { section: 'reports', to: '/reports', label: 'Reportes', icon: PiScroll },
      { section: 'audit', to: '/audit', label: 'Auditoría', icon: PiShieldCheck },
      { section: 'users', to: '/users', label: 'Usuarios', icon: PiUsers },
      { section: 'config', to: '/config', label: 'Configuración', icon: PiGear },
    ],
  },
]

const ALL_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

export function sectionTitle(pathname: string): string | undefined {
  return ALL_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.label
}

/** La etiqueta del menú en el idioma de quien mira.
 *
 *  Las etiquetas de arriba siguen en español a propósito: son el respaldo
 *  cuando falta una traducción, y con `defaultValue` una clave sin traducir
 *  sale legible en vez de salir como `nav.frontdesk`. La clave es la sección,
 *  que ya existía y no cambia de nombre entre idiomas.
 */
export function etiquetaDeSeccion(
  t: (clave: string, opciones?: { defaultValue: string }) => string,
  seccion: string,
  respaldo: string,
): string {
  return t(`nav.${seccion}`, { defaultValue: respaldo })
}

/** Los encabezados del menú, que no son secciones sino agrupaciones. */
const GRUPO_I18N: Record<string, string> = {
  platform: 'grupoPlataforma',
  daily: 'grupoOperacion',
  management: 'grupoGestion',
}

export function etiquetaDeGrupo(
  t: (clave: string, opciones?: { defaultValue: string }) => string,
  grupo: string,
  respaldo: string,
): string {
  return t(`nav.${GRUPO_I18N[grupo] ?? grupo}`, { defaultValue: respaldo })
}
