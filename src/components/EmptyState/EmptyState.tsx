import { RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../Button/Button'
import { cx } from '../cx'
import styles from './EmptyState.module.css'
import { Illustration, type IllustrationName } from './illustrations'

export interface EmptyStateProps {
  /**
   * A small line drawing: sheets (nothing here yet), done (all caught up; the tick draws itself),
   * log (empty mistake log), search (no matches). Or pass `icon` instead.
   */
  illustration?: IllustrationName
  /** A Lucide icon shown in a soft disc, when no illustration fits. */
  icon?: ReactNode
  title: ReactNode
  /** One or two calm sentences: why it is empty and what to do next. */
  children?: ReactNode
  /** Buttons, e.g. a primary ButtonLink to create the first card. */
  actions?: ReactNode
  /** Less vertical padding, for use inside a sheet or panel. */
  compact?: boolean
  /** Heading level for the title. Default h2. */
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/** What a screen shows when there is nothing to show yet. */
export function EmptyState({
  illustration,
  icon,
  title,
  children,
  actions,
  compact = false,
  headingLevel: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.state, compact && styles.compact, className)}>
      {illustration ? (
        <div className={styles.art}>
          <Illustration name={illustration} />
        </div>
      ) : icon ? (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <Heading className={styles.title}>{title}</Heading>
      {children ? <div className={styles.body}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  )
}

export interface ErrorStateProps {
  /** Default: "That didn't load". */
  title?: ReactNode
  /** Friendly explanation, e.g. friendlyError(error). Default asks to check the connection. */
  message?: ReactNode
  /** Shows a Try again button. */
  onRetry?: () => void
  /** Spinner on the retry button while refetching. */
  retrying?: boolean
  compact?: boolean
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/** A friendly failure message with a way to try again. Announced politely when it appears. */
export function ErrorState({
  title = 'That didn’t load',
  message = 'Check your connection, then try again.',
  onRetry,
  retrying = false,
  compact = false,
  headingLevel = 'h2',
  className,
}: ErrorStateProps) {
  return (
    <div role="status" className={className}>
      <EmptyState
        illustration="torn"
        title={title}
        compact={compact}
        headingLevel={headingLevel}
        actions={
          onRetry ? (
            <Button variant="secondary" leadingIcon={<RotateCcw />} loading={retrying} onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      >
        {message}
      </EmptyState>
    </div>
  )
}
