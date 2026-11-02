import { CircleAlert, Info, X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cx, IconButton, Sheet } from '../../components'
import styles from './auth.module.css'

export interface AuthPanelProps {
  title: ReactNode
  description?: ReactNode
  /** Something above the title: a pen mark, for instance. */
  art?: ReactNode
  /** Quiet text under the sheet. */
  footer?: ReactNode
  children?: ReactNode
}

/** One auth screen: a sheet of paper with a serif title, and an optional note beneath it. */
export function AuthPanel({ title, description, art, footer, children }: AuthPanelProps) {
  const titleId = useId()
  return (
    <>
      <Sheet as="section" padding="md" className={styles.sheet} aria-labelledby={titleId}>
        {art ? <div className={styles.art}>{art}</div> : null}
        <h1 id={titleId} className={styles.title}>
          {title}
        </h1>
        {description ? <div className={styles.description}>{description}</div> : null}
        {children ? <div className={styles.body}>{children}</div> : null}
      </Sheet>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </>
  )
}

export interface AuthNoticeProps {
  /** error: ruled in red and announced; info: ruled in ink. */
  tone?: 'error' | 'info'
  children: ReactNode
  /** Shows a dismiss button. */
  onDismiss?: () => void
  className?: string
}

/** A calm, ruled note inside an auth sheet: a failed link, a sign-in error, a demo hint. */
export function AuthNotice({ tone = 'error', children, onDismiss, className }: AuthNoticeProps) {
  const Icon = tone === 'error' ? CircleAlert : Info
  return (
    <div className={cx(styles.notice, tone === 'error' ? styles.noticeError : styles.noticeInfo, className)} role={tone === 'error' ? 'alert' : undefined}>
      <Icon className={styles.noticeIcon} aria-hidden="true" />
      <div className={styles.noticeText}>{children}</div>
      {onDismiss ? (
        <IconButton size="sm" label="Dismiss" icon={<X />} onClick={onDismiss} className={styles.noticeDismiss} />
      ) : null}
    </div>
  )
}
