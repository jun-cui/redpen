import { House, Layers, PenLine, Settings, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Only active on exactly this path (Home), not on its children. */
  end?: boolean
  /** Shows the number of cards due now beside the label. */
  showsDueCount?: boolean
}

/**
 * The main destinations, in order, for the sidebar and the tab bar. Stage 4 adds Mistakes
 * (/mistakes) after Cards; the tab bar lays out however many there are.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/review', label: 'Review', icon: PenLine, showsDueCount: true },
  { to: '/cards', label: 'Cards', icon: Layers },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** "99+" past two digits, so the badge never grows wider than the tab. */
export function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}
