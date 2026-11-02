import { ArrowRight, Home, Layers, PenLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ButtonLink, EmptyState, Skeleton } from '../../components'
import { useCards, useDueSummary } from '../../data/hooks'
import { formatRelativeDue } from '../../lib/dates'
import { subjectInfo } from '../../lib/subjects'
import type { SubjectCode } from '../../lib/types'
import { cardCount, dueNowCount, soonestDue } from './copy'
import { REQUEUE_WINDOW_MS } from './queue'
import styles from './NothingDue.module.css'

/** Look again a moment after the next card's due time, so it is certainly due by then. */
const RECHECK_MARGIN_MS = 1000

export interface NothingDueProps {
  /** The session was limited to one subject. */
  subject?: SubjectCode
  /**
   * Looks for due cards again. Called by itself when the next card comes due within a few
   * minutes (a learning step), so the session starts without a reload.
   */
  onRecheck?: () => void
}

/** The review screen when no card is due: when the next one is, and where to go instead. */
export function NothingDue({ subject, onRecheck }: NothingDueProps) {
  return subject ? (
    <SubjectNothingDue subject={subject} onRecheck={onRecheck} />
  ) : (
    <EverythingNothingDue onRecheck={onRecheck} />
  )
}

function EverythingNothingDue({ onRecheck }: { onRecheck?: () => void }) {
  const summary = useDueSummary()
  // Cards that came due after the session's snapshot was taken count as due "now".
  const nextDueAt =
    summary.data && summary.data.dueNow > 0 ? new Date(summary.dataUpdatedAt).toISOString() : (summary.data?.nextDueAt ?? null)
  return (
    <NothingDueView
      total={summary.data?.total}
      nextDueAt={nextDueAt}
      dueElsewhere={0}
      loading={summary.isPending}
      onRecheck={onRecheck}
    />
  )
}

/** One subject: the due summary covers every subject, so its own numbers come from its cards. */
function SubjectNothingDue({ subject, onRecheck }: { subject: SubjectCode; onRecheck?: () => void }) {
  const summary = useDueSummary()
  const cards = useCards()
  const total = cards.data?.filter((card) => card.subject === subject).length
  const dueElsewhere = summary.data ? dueNowCount(summary.data) - dueNowCount(summary.data, subject) : 0
  return (
    <NothingDueView
      subject={subject}
      total={total}
      nextDueAt={cards.data ? soonestDue(cards.data, subject) : null}
      dueElsewhere={dueElsewhere}
      loading={cards.isPending}
      onRecheck={onRecheck}
    />
  )
}

interface NothingDueViewProps {
  subject?: SubjectCode
  /** Cards in the box (or the subject), including suspended ones; undefined while unknown. */
  total: number | undefined
  /** When the next card is due; in the past for one that came due after the session began. */
  nextDueAt: string | null
  /** Cards due now in other subjects (a subject session only). */
  dueElsewhere: number
  loading: boolean
  onRecheck?: () => void
}

function NothingDueView({ subject, total, nextDueAt, dueElsewhere, loading, onRecheck }: NothingDueViewProps) {
  const [now] = useState(() => new Date())
  const subjectName = subject ? subjectInfo(subject).name : null

  // A card due within the requeue window (a learning step), or one that came due after the
  // session began: wait for it here, then look again (once per due time).
  useEffect(() => {
    if (!nextDueAt || !onRecheck) return
    const wait = Date.parse(nextDueAt) - Date.now()
    if (!(wait <= REQUEUE_WINDOW_MS)) return
    const timer = window.setTimeout(onRecheck, Math.max(wait, 0) + RECHECK_MARGIN_MS)
    return () => window.clearTimeout(timer)
  }, [nextDueAt, onRecheck])

  const when = nextDueAt ? formatRelativeDue(new Date(nextDueAt), now) : null

  if (total === 0) {
    return (
      <EmptyState
        illustration="sheets"
        title={subjectName ? `No ${subjectName} cards yet` : 'No cards yet'}
        actions={
          <>
            <ButtonLink to={subject ? `/cards/new?subject=${subject}` : '/cards/new'} variant="primary" leadingIcon={<PenLine />}>
              Write a card
            </ButtonLink>
            <ButtonLink to="/" variant="secondary" leadingIcon={<Home />}>
              Home
            </ButtonLink>
          </>
        }
      >
        Write a card from your notes or a mark scheme, and it will be ready to review straight away.
      </EmptyState>
    )
  }

  return (
    <EmptyState
      illustration="done"
      title="Nothing due right now"
      actions={
        <>
          {dueElsewhere > 0 ? (
            <ButtonLink to="/review" variant="primary" trailingIcon={<ArrowRight />}>
              Review all subjects
            </ButtonLink>
          ) : null}
          <ButtonLink to="/" variant={dueElsewhere > 0 ? 'secondary' : 'primary'} leadingIcon={<Home />}>
            Home
          </ButtonLink>
          <ButtonLink to="/cards" variant="secondary" leadingIcon={<Layers />}>
            Browse cards
          </ButtonLink>
        </>
      }
    >
      {loading ? (
        <span className={styles.loading} aria-hidden="true">
          <Skeleton width="80%" height="1em" />
        </span>
      ) : (
        <p>
          {subjectName ? `You’re up to date with ${subjectName}.` : 'You’re up to date.'}
          {when === 'now' ? ' The next card is due in a moment.' : when ? ` The next card is due ${when}.` : null}
          {dueElsewhere > 0
            ? ` ${cardCount(dueElsewhere)} in other subjects ${dueElsewhere === 1 ? 'is' : 'are'} due now.`
            : null}
        </p>
      )}
    </EmptyState>
  )
}
