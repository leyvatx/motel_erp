import {
  ClipboardList,
  LayoutGrid,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  section: string
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: readonly NavItem[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { section: 'frontdesk', to: '/frontdesk', label: 'Recepción', icon: LayoutGrid },
      { section: 'housekeeping', to: '/housekeeping', label: 'Ama de llaves', icon: ClipboardList },
      { section: 'inventory', to: '/inventory', label: 'Inventarios', icon: Package },
      { section: 'finances', to: '/finances', label: 'Finanzas', icon: Wallet },
    ],
  },
  {
    label: 'Control',
    items: [
      { section: 'reports', to: '/reports', label: 'Reportes', icon: ScrollText },
      { section: 'audit', to: '/audit', label: 'Auditoría', icon: ShieldCheck },
      { section: 'users', to: '/users', label: 'Usuarios', icon: Users },
      { section: 'config', to: '/config', label: 'Configuración', icon: Settings },
    ],
  },
]

const ALL_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

export function sectionTitle(pathname: string): string | undefined {
  return ALL_ITEMS.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  )?.label
}
