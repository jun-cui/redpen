import { useMemo, useState } from 'react'
import { Button, Chip, Dialog, SubjectBadge } from '../../components'
import type { RecordReviewResult } from '../../data/api'
import { useRecordReview } from '../../data/hooks'
import { friendlyError } from '../../lib/errors'
import { previewNextDue } from '../../lib/fsrs'
import { isFullMarks, scoreOf } from '../../lib/scoring'
import { nextReviewLabel, pointsLabel } from './copy'
import { MarkSchemePanel } from './MarkSchemePanel'
import { buildOverrideInput, changedPointCount, effectiveEasy, overrideResults, ratingFor } from './marking'
import type { SessionRecord } from './sessionRecords'
import styles from './ChangeMarksDialog.module.css'

export interface ChangeMarksDialogProps {
  /** The saved answer whose marks are being changed; null when the dialog is closed. */
  record: SessionRecord | null
  retention: number
  onClose: () => void
  /** The new marks are saved: the session updates its record, the card and the queue. */
  onChanged: (recordKey: string, result: RecordReviewResult) => void
  /** Where focus goes on close if what opened the dialog has gone (see Dialog). */
  returnFocus?: () => HTMLElement | null
}

interface Draft {
  record: SessionRecord
  hits: Record<string, boolean>
  easy: boolean
  /** Points ticked or unticked in this dialog: only those draw; the rest show as saved. */
  touched: ReadonlySet<string>
  /** When the dialog opened, for "Next review in ...". */
  openedAt: Date
}

function freshDraft(record: SessionRecord): Draft {
  return {
    record,
    hits: Object.fromEntries(record.review.results.map((result) => [result.key_point_id, result.hit])),
    easy: record.review.easy,
    touched: new Set(),
    openedAt: new Date(),
  }
}

/**
 * Re-marks a saved answer (an override). The card is rescheduled as if it had been marked this
 * way at the time, and the database rebuilds its mistake-log rows and category.
 */
export function ChangeMarksDialog({ record, retention, onClose, onChanged, returnFocus }: ChangeMarksDialogProps) {
  const recordReview = useRecordReview()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Each time the dialog opens, start from the marks as saved. While it closes, the last draft
  // stays on screen for the exit animation.
  const key = record?.key ?? null
  if (key !== openKey) {
    setOpenKey(key)
    if (record) {
      setDraft(freshDraft(record))
      setError(null)
    }
  }

  const review = draft?.record.review
  const results = useMemo(
    () => (draft && review ? overrideResults(review.results, draft.hits) : []),
    [draft, review],
  )
  const score = scoreOf(results)
  const fullMarks = isFullMarks(score)
  const easy = draft ? effectiveEasy(results, draft.easy) : false
  const changed = review ? changedPointCount(review.results, results) > 0 || easy !== review.easy : false
  const nextDue = review ? previewNextDue(review.card_before, new Date(review.reviewed_at), retention)[ratingFor(results, easy)] : null
  const pending = recordReview.isPending

  const toggle = (keyPointId: string) => {
    if (pending) return
    setDraft((current) =>
      current
        ? {
            ...current,
            hits: { ...current.hits, [keyPointId]: !current.hits[keyPointId] },
            touched: new Set(current.touched).add(keyPointId),
          }
        : current,
    )
  }

  const save = async () => {
    if (!draft || !review || !changed || pending) return
    setError(null)
    try {
      const result = await recordReview.mutateAsync(buildOverrideInput(review, results, easy, retention))
      onChanged(draft.record.key, result)
    } catch (caught) {
      setError(friendlyError(caught))
    }
  }

  const card = draft?.record.card

  return (
    <Dialog
      open={record !== null}
      onClose={onClose}
      returnFocus={returnFocus}
      dismissible={!pending}
      size="wide"
      title="Change your marks"
      description="Your schedule and mistake log will update to match."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={pending} disabled={!changed}>
            Save marks
          </Button>
        </>
      }
    >
      {draft && review && card ? (
        <div className={styles.body}>
          <div className={styles.question}>
            <SubjectBadge subject={card.subject} compact />
            <p className={styles.questionText}>{card.question}</p>
          </div>

          <div className={styles.answer}>
            <p className={styles.answerLabel}>Your answer</p>
            {review.answer.trim() ? (
              <p className={styles.answerText}>{review.answer}</p>
            ) : (
              <p className={styles.noAnswer}>No answer written.</p>
            )}
          </div>

          <MarkSchemePanel
            results={results}
            keyPoints={card.key_points}
            onToggle={toggle}
            disabled={pending}
            title="Mark scheme"
            description="Tick each point you made."
            elevation="flat"
            isInstant={(id) => !draft.touched.has(id)}
          />

          <div className={styles.outcome}>
            <div className={styles.status} aria-live="polite" aria-atomic="true">
              <p className={styles.scoreLine}>{pointsLabel(score.hit, score.total)}</p>
              {nextDue ? <p className={styles.dueLine}>{nextReviewLabel(nextDue, draft.openedAt)}</p> : null}
            </div>
            {fullMarks ? (
              <Chip
                selected={easy}
                disabled={pending}
                onClick={() => setDraft((current) => (current ? { ...current, easy: !easy } : current))}
              >
                That was easy
              </Chip>
            ) : null}
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  )
}
