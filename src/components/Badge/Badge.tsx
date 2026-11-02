import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { CardCategory, SubjectCode } from '../../lib/types'
import { subjectInfo } from '../../lib/subjects'
import { cx } from '../cx'
import styles from './Badge.module.css'

export type BadgeTone = 'neutral' | 'outline' | 'ink' | 'red'

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  /** neutral (quiet fill, default), outline, ink (solid), red (marking only). */
  tone?: BadgeTone
  /** Small icon before the text (12px). */
  icon?: ReactNode
}

/** A small static label. Not interactive: use Chip for filters. */
export function Badge({ tone = 'neutral', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)} {...rest}>
      {icon}
      {children}
    </span>
  )
}

export const CATEGORY_LABELS: Readonly<Record<CardCategory, string>> = {
  new: 'New',
  learning: 'Learning',
  weak: 'Weak',
  mastered: 'Mastered',
}

/** Ring glyphs that fill up as a card is learned; weak gets an examiner's red slash. */
function CategoryGlyph({ category }: { category: CardCategory }) {
  return (
    <svg className={styles.glyph} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      {category === 'new' ? <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.25" /> : null}
      {category === 'learning' ? (
        <>
          <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <path d="M5 1.25a3.75 3.75 0 0 0 0 7.5z" fill="currentColor" />
        </>
      ) : null}
      {category === 'weak' ? (
        <>
          <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <path d="M2.2 7.9 7.9 2.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : null}
      {category === 'mastered' ? <circle cx="5" cy="5" r="4.25" fill="currentColor" /> : null}
    </svg>
  )
}

export interface CategoryBadgeProps {
  category: CardCategory
  className?: string
}

/** New / Learning / Weak / Mastered, distinguished by ink tone, outline and glyph. */
export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <span className={cx(styles.badge, styles[category], className)}>
      <CategoryGlyph category={category} />
      {CATEGORY_LABELS[category]}
    </span>
  )
}

export interface SubjectBadgeProps {
  subject: SubjectCode
  /** Show only the short code ("FM"); the full name becomes its accessible name and tooltip. */
  compact?: boolean
  className?: string
}

/** A subject's short code in a small serif box, followed by its name. */
export function SubjectBadge({ subject, compact = false, className }: SubjectBadgeProps) {
  const info = subjectInfo(subject)
  if (compact) {
    return (
      <span className={cx(styles.code, className)} title={info.name} aria-label={info.name} role="img">
        {info.short}
      </span>
    )
  }
  return (
    <span className={cx(styles.subject, className)}>
      <span className={styles.code} aria-hidden="true">
        {info.short}
      </span>
      <span className={styles.name}>{info.name}</span>
    </span>
  )
}
