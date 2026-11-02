import { cx } from '../cx'
import styles from './Spinner.module.css'

const SIZES = { sm: 16, md: 20, lg: 28 } as const

export interface SpinnerProps {
  /** sm 16px, md 20px (default), lg 28px, or a size in px. */
  size?: keyof typeof SIZES | number
  /** Announced to screen readers. Omit when the surrounding control already says it is busy. */
  label?: string
  className?: string
}

/** A small rotating arc in the current text colour. Prefer skeletons for page content. */
export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const px = typeof size === 'number' ? size : SIZES[size]
  return (
    <span className={cx(styles.spinner, className)} role={label ? 'status' : undefined}>
      <svg
        className={styles.svg}
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        data-motion-safe=""
      >
        <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <path d="M12 2.75a9.25 9.25 0 0 1 9.25 9.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label ? <span className="visually-hidden">{label}</span> : null}
    </span>
  )
}
