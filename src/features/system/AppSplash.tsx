import { useState } from 'react'
import { BrandMark } from '../../components'
import styles from './AppSplash.module.css'

/** The mark fades in this long after the first splash appears, so quick loads show only paper. */
const APPEAR_AFTER_MS = 180

let firstShownAt: number | null = null

/**
 * Milliseconds until the fade should start. Every splash shares one clock, so when one splash
 * replaces another (the router's, then the auth check's) the fade carries on instead of restarting.
 */
function fadeDelay(): number {
  firstShownAt ??= performance.now()
  return Math.round(firstShownAt + APPEAR_AFTER_MS - performance.now())
}

export interface AppSplashProps {
  /** Announced to screen readers. */
  label?: string
}

/** Full-screen loading state: the red tick on paper, matching the iOS launch screen. */
export function AppSplash({ label = 'Loading Redpen' }: AppSplashProps) {
  const [delay] = useState(fadeDelay)
  return (
    <div className={styles.splash} role="status">
      <span className={styles.mark} style={{ animationDelay: `${delay}ms` }}>
        <BrandMark size={56} />
      </span>
      <span className="visually-hidden">{label}</span>
    </div>
  )
}
