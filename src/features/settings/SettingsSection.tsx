import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cx, Sheet } from '../../components'
import styles from './SettingsSection.module.css'

export interface SettingsSectionProps {
  /** Used for the heading's id (`<id>-heading`). */
  id: string
  title: ReactNode
  /** One short line under the title. */
  description?: ReactNode
  /** Rows and blocks; they are separated by hairlines. */
  children: ReactNode
}

/** A titled group of settings on a sheet of paper. Title beside the sheet on desktop, above it on phones. */
export function SettingsSection({ id, title, description, children }: SettingsSectionProps) {
  const headingId = `${id}-heading`
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.intro}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      <Sheet padding="none" className={styles.sheet}>
        {children}
      </Sheet>
    </section>
  )
}

export interface SettingsRowProps {
  label: ReactNode
  description?: ReactNode
  /** A Lucide icon before the label. */
  icon?: ReactNode
  /** The control: a button, switch or value. Beside the text when it fits, under it otherwise. */
  children?: ReactNode
  /**
   * The control is wide (e.g. a segmented control): it needs a wider sheet before it moves beside
   * the text, and under the text it takes the row's full width.
   */
  wideControl?: boolean
  className?: string
}

/**
 * One setting: icon, label and description, with its control on the right when the sheet has
 * room and under the text (lined up with it) when it doesn't.
 */
export function SettingsRow({ label, description, icon, children, wideControl = false, className }: SettingsRowProps) {
  const hasControl = children !== undefined && children !== null
  return (
    <div
      className={cx(
        styles.item,
        styles.setting,
        !icon && styles.noIcon,
        !hasControl && styles.noControl,
        wideControl && styles.wideControl,
        className,
      )}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className={styles.text}>
        <h3 className={styles.label}>{label}</h3>
        {description ? <div className={styles.rowDescription}>{description}</div> : null}
      </div>
      {hasControl ? <div className={styles.control}>{children}</div> : null}
    </div>
  )
}

/** Free-form content (a form, a note) padded and separated like a row. */
export function SettingsBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.item, styles.block, className)}>{children}</div>
}

export interface SettingsLinkRowProps {
  to: string
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
}

/** A whole row that opens another settings page. */
export function SettingsLinkRow({ to, label, description, icon }: SettingsLinkRowProps) {
  return (
    <Link to={to} className={cx(styles.item, styles.row, styles.linkRow)}>
      <span className={styles.lead}>
        {icon ? (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          {description ? <span className={styles.rowDescription}>{description}</span> : null}
        </span>
      </span>
      <ChevronRight className={styles.chevron} aria-hidden="true" />
    </Link>
  )
}
