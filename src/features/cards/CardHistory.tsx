import { PencilLine } from 'lucide-react'
import { useState } from 'react'
import { Button, CategoryBadge, ErrorState, ScoreMark, Sheet, Skeleton, Switch, useToast } from '../../components'
import type { RecordReviewResult } from '../../data/api'
import { useCard, useCardReviews, useProfile } from '../../data/hooks'
import type { CardRow, ReviewRow } from '../../lib/database.types'
import { formatShortDate } from '../../lib/dates'
import { friendlyError } from '../../lib/errors'
import { DEFAULT_RETENTION, RATING_LABELS } from '../../lib/fsrs'
import type { Grading } from '../../lib/types'
import { ChangeMarksDialog } from '../review/ChangeMarksDialog'
import { nextReviewLabel } from '../review/copy'
import type { SessionRecord } from '../review/sessionRecords'
import styles from './CardHistory.module.css'
import { dueLabel } from './cardFilters'

const GRADING_LABELS: Record<Grading, string> = {
  self: 'Self-marked',
  ai: 'Marked by AI',
  ai_fallback: 'Self-marked (AI unavailable)',
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

function formatWhen(iso: string, now: Date): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${formatShortDate(date, now)}, ${timeFormat.format(date)}`
}

export interface ScheduleFactsProps {
  card: CardRow
  now: Date
  /** What the switch shows (the saved value, or the one being saved). */
  suspended: boolean
  onSuspendedChange: (suspended: boolean) => void
  className?: string
}

/** When the card is next due and how it has gone so far, with the switch to pause it. */
export function ScheduleFacts({ card, now, suspended, onSuspendedChange, className }: ScheduleFactsProps) {
  const due = dueLabel({ due: card.due, suspended }, now)
  const showDate = !suspended && Date.parse(card.due) > now.getTime()
  return (
    <Sheet as="aside" elevation="flat" padding="md" className={className} aria-labelledby="schedule-title">
      <h2 id="schedule-title" className={styles.asideTitle}>
        Schedule
      </h2>
      <div className={styles.status}>
        <CategoryBadge category={card.category} />
        <span className={styles.due}>
          {due}
          {showDate ? <span className={styles.dueDate}> · {formatShortDate(card.due, now)}</span> : null}
        </span>
      </div>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Reviews</dt>
          <dd>{card.reps}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Times forgotten</dt>
          <dd>{card.lapses}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Last score</dt>
          <dd>{card.last_score === null ? '–' : `${Math.round(card.last_score * 100)}%`}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Added</dt>
          <dd>{formatShortDate(card.created_at, now)}</dd>
        </div>
      </dl>
      <div className={styles.switch}>
        <Switch
          checked={suspended}
          onChange={onSuspendedChange}
          label="Pause reviews"
          description="A paused card stays in your box but doesn’t come up for review."
        />
      </div>
    </Sheet>
  )
}

/**
 * The card's recent reviews, newest first, each with its score in red as it was marked. The
 * newest one's marks can still be changed (only the latest review of a card can be).
 */
export function ReviewHistory({ cardId, now, className }: { cardId: string; now: Date; className?: string }) {
  const reviews = useCardReviews(cardId)
  const card = useCard(cardId).data
  const retention = useProfile().data?.desired_retention ?? DEFAULT_RETENTION
  const toast = useToast()
  const [amending, setAmending] = useState<ReviewRow | null>(null)

  // The dialog works on a session's record: this review, with the card as it is now (the review
  // keeps the points as they were marked).
  const record: SessionRecord | null =
    amending && card ? { key: amending.id, cardId: card.id, review: amending, card } : null

  const onChanged = (_key: string, result: RecordReviewResult) => {
    setAmending(null)
    toast.show({ message: `Marks updated. ${nextReviewLabel(result.card.due, new Date())}.` })
  }

  return (
    <section className={className} aria-labelledby="history-title">
      <h2 id="history-title" className={styles.title}>
        Review history
      </h2>
      {reviews.isPending ? (
        <div aria-busy="true" className={styles.list}>
          <span className="visually-hidden">Loading reviews</span>
          {[0, 1, 2].map((index) => (
            <div key={index} className={styles.review}>
              <Skeleton width={64} height={44} radius="pill" />
              <span className={styles.reviewText}>
                <Skeleton width={120} height={16} />
                <Skeleton width={160} height={14} />
              </span>
            </div>
          ))}
        </div>
      ) : reviews.isError ? (
        <ErrorState
          compact
          headingLevel="h3"
          title="Reviews didn’t load"
          message={friendlyError(reviews.error)}
          onRetry={() => void reviews.refetch()}
          retrying={reviews.isFetching}
        />
      ) : reviews.data.length === 0 ? (
        <p className={styles.empty}>No reviews yet. Answers you mark will be listed here.</p>
      ) : (
        <ol role="list" className={styles.list}>
          {reviews.data.map((review, index) => (
            <li key={review.id} className={styles.review}>
              <span className={styles.score}>
                <ScoreMark score={review.points_hit} total={review.points_total} seed={review.id} instant />
              </span>
              <span className={styles.reviewText}>
                <span className={styles.reviewDate}>{formatWhen(review.reviewed_at, now)}</span>
                <span className={styles.reviewMeta}>
                  {RATING_LABELS[review.rating]} · {GRADING_LABELS[review.grading]}
                  {review.amended_at ? ' · changed after marking' : ''}
                </span>
              </span>
              {index === 0 && card ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<PencilLine />}
                  className={styles.change}
                  onClick={() => setAmending(review)}
                  aria-label={`Change marks: ${formatWhen(review.reviewed_at, now)}`}
                >
                  Change marks
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <ChangeMarksDialog
        record={record}
        retention={retention}
        onClose={() => {
          setAmending(null)
          // The card may have been reviewed again elsewhere (then saving was refused): show it.
          void reviews.refetch()
        }}
        onChanged={onChanged}
      />
    </section>
  )
}
