import { FlaskConical } from 'lucide-react'
import { Badge, cx } from '../../components'
import { isDemoMode } from '../../lib/env'
import styles from './DemoBadge.module.css'

export interface DemoNoticeProps {
  /** compact: the badge with the explanation as its tooltip; full: badge and a short line. */
  variant?: 'compact' | 'full'
  className?: string
}

/**
 * A small "Demo" badge explaining that, in demo mode, cards live only in this browser.
 * Renders nothing outside demo mode (and is dropped from production builds).
 */
export function DemoNotice({ variant = 'full', className }: DemoNoticeProps) {
  if (!(import.meta.env.DEV && isDemoMode)) return null
  const explanation = 'Demo mode: your cards are saved in this browser only.'
  if (variant === 'compact') {
    return (
      <Badge tone="outline" icon={<FlaskConical aria-hidden="true" />} title={explanation} className={className}>
        Demo
      </Badge>
    )
  }
  return (
    <div className={cx(styles.notice, className)}>
      <Badge tone="outline" icon={<FlaskConical aria-hidden="true" />}>
        Demo
      </Badge>
      <p className={styles.text}>Cards are saved in this browser only.</p>
    </div>
  )
}
