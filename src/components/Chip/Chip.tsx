import { Check } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../cx'
import styles from './Chip.module.css'

export interface ChipProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Whether the filter is on (aria-pressed). Selected chips are ink with a check. */
  selected: boolean
  children: ReactNode
  /** Optional icon shown while not selected (the check replaces it when selected). */
  icon?: ReactNode
  /** Optional count after the label, e.g. cards matching this filter. */
  count?: number
}

/** A toggleable filter chip. Toggle `selected` in onClick. */
export function Chip({ selected, children, icon, count, type = 'button', className, ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={selected} className={cx(styles.chip, selected && styles.selected, className)} {...rest}>
      {selected ? <Check aria-hidden="true" strokeWidth={2.25} /> : icon}
      <span>{children}</span>
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </button>
  )
}
