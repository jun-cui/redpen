import { useId } from 'react'
import { CategoryBadge, Sheet } from '../../components'
import type { CardCategory } from '../../lib/types'
import { cardCount } from './greeting'
import styles from './CardBoxOverview.module.css'

/** In the order a card moves through them. */
const CATEGORIES: readonly CardCategory[] = ['new', 'learning', 'weak', 'mastered']

export interface CardBoxOverviewProps {
  /** Cards that aren't suspended, per category. */
  byCategory: Record<CardCategory, number>
  /** All cards, suspended ones included. */
  total: number
  className?: string
}

/**
 * How the card box breaks down by category, as plain counts. (The Stage 4 dashboard adds charts
 * alongside this.)
 */
export function CardBoxOverview({ byCategory, total, className }: CardBoxOverviewProps) {
  const headingId = useId()
  const active = CATEGORIES.reduce((sum, category) => sum + byCategory[category], 0)
  const suspended = Math.max(total - active, 0)

  return (
    <Sheet as="section" padding="none" className={className} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          Your cards
        </h2>
        <p className={styles.total}>{cardCount(active)}</p>
      </div>
      <dl className={styles.list}>
        {CATEGORIES.map((category) => (
          <div key={category} className={styles.row}>
            <dt>
              <CategoryBadge category={category} />
            </dt>
            <dd className={styles.count}>{byCategory[category]}</dd>
          </div>
        ))}
      </dl>
      {suspended > 0 ? <p className={styles.note}>{suspended} suspended, not counted here</p> : null}
    </Sheet>
  )
}
