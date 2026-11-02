import { CirclePause } from 'lucide-react'
import { Link } from 'react-router'
import { CategoryBadge, cx, sheetClassName, SubjectBadge } from '../../components'
import type { CardRow } from '../../lib/database.types'
import styles from './CardListItem.module.css'
import { dueLabel, isDueNow, marksLabel } from './cardFilters'

export interface CardListItemProps {
  card: CardRow
  /** The topic's name, or null when the card has none. */
  topicName: string | null
  now: Date
  /** Router state for the editor, e.g. where to go back to. */
  linkState?: unknown
}

/** A card in the library: a paper index card that opens the editor. */
export function CardListItem({ card, topicName, now, linkState }: CardListItemProps) {
  const due = isDueNow(card, now)
  return (
    <Link
      to={`/cards/${card.id}`}
      state={linkState}
      className={sheetClassName({ interactive: true, padding: 'none', className: styles.card })}
    >
      <span className={styles.eyebrow}>
        <SubjectBadge subject={card.subject} compact />
        <span className={cx(styles.topic, !topicName && styles.noTopic)}>{topicName ?? 'No topic'}</span>
      </span>
      <span className={styles.question}>{card.question}</span>
      <span className={styles.footer}>
        <CategoryBadge category={card.category} />
        <span className={styles.marks}>{marksLabel(card.key_points.length)}</span>
        <span className={cx(styles.due, due && styles.dueNow, card.suspended && styles.paused)}>
          {card.suspended ? <CirclePause aria-hidden="true" /> : null}
          {dueLabel(card, now)}
        </span>
      </span>
    </Link>
  )
}
