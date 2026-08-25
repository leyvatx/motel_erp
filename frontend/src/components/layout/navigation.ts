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
  label: string
  items: readonly NavItem[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Plataforma',
    items: [
      { section: 'platform', to: '/platform', label: 'Moteles', icon: PiBuildings },
      { section: 'corporate', to: '/corporate', label: 'Corporativo', icon: PiTreeStructure },
    ],
  },
  {
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
      { section: 'finances', to: '/finances', label: 'Finanzas', icon: PiWallet },
    ],
  },
  {
    label: 'Control',
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
