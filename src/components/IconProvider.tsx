import { LucideProvider } from 'lucide-react'
import type { ReactNode } from 'react'

/** Lucide defaults for the whole app: 20px icons at a 1.75 stroke. Wrap the app once. */
export function IconProvider({ children }: { children: ReactNode }) {
  return (
    <LucideProvider size={20} strokeWidth={1.75}>
      {children}
    </LucideProvider>
  )
}
