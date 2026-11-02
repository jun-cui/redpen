// One card's marking: the state machine in ./cardMachine, wired to the data layer.
//
// Stage 1 self-grades: handing the answer in goes straight to 'marked' with nothing ticked.
// Stage 2 swaps the body of `submit` for a call to the AI marker (the machine already has the
// 'marking' phase for it) and keeps self-grading as the fallback.
//
// The session's copy of a card can be out of date (it may have changed on another device), so a
// save can be refused as a conflict. Then the card is fetched as it is now: with the same key
// points the save is retried once from there, unnoticed; with new ones the student checks their
// ticks against the new mark scheme.

import { useMemo, useReducer, useRef, useState } from 'react'
import type { RecordReviewResult } from '../../data/api'
import { useRecordReview, useRefreshCard } from '../../data/hooks'
import type { CardRow } from '../../lib/database.types'
import { CARD_CONFLICT_CODE, hasErrorCode } from '../../lib/errors'
import { previewNextDue, snapshotFromRow } from '../../lib/fsrs'
import { newUuid } from '../../lib/ids'
import { isFullMarks, scoreOf } from '../../lib/scoring'
import type { FsrsSnapshot } from '../../lib/types'
import { cardReducer, hasUnsavedWork, initialCardState } from './cardMachine'
import {
  buildReviewInput,
  effectiveEasy,
  marksKeyPoints,
  ratingFor,
  rebuildMarking,
  rescheduleTime,
  selfMarking,
  type Marking,
} from './marking'

/** A card found to be gone during a conflict: reported like record_review reports it. */
const CARD_GONE = { code: 'P0002', message: 'Card not found' }

export interface CardMarkingOptions {
  card: CardRow
  retention: number
  /** Saved: `markedAt` is the moment the review was recorded at (reviewed_at). */
  onSaved: (result: RecordReviewResult, markedAt: Date) => void
  onSaveFailed: (error: unknown) => void
  /** The card's key points changed on another device: the marks need checking again. */
  onCardChanged: () => void
}

export function useCardMarking({ card, retention, onSaved, onSaveFailed, onCardChanged }: CardMarkingOptions) {
  const [state, dispatch] = useReducer(cardReducer, undefined, () => initialCardState())
  // When the card appeared, for duration_ms.
  const [shownAt] = useState(() => Date.now())
  const recordReview = useRecordReview()
  const refreshCard = useRefreshCard()
  const saving = useRef(false)

  const results = useMemo(() => state.marking?.results ?? [], [state.marking])
  const score = scoreOf(results)
  const fullMarks = isFullMarks(score)
  const easy = effectiveEasy(results, state.easy)
  const rating = ratingFor(results, easy)
  const markedAt = useMemo(() => (state.markedAt === null ? null : new Date(state.markedAt)), [state.markedAt])

  // Every possible next due date, from the moment the answer was handed in.
  const preview = useMemo(
    () => (state.before && markedAt ? previewNextDue(state.before, markedAt, retention) : null),
    [state.before, markedAt, retention],
  )

  const setAnswer = (answer: string) => dispatch({ type: 'answer', answer })

  /** Hands the answer in. With `giveUp` ("I don't know") the answer is recorded as empty. */
  const submit = ({ giveUp = false }: { giveUp?: boolean } = {}) => {
    if (state.phase !== 'answering') return
    if (!giveUp && state.answer.trim().length === 0) return
    dispatch({
      type: 'submit',
      at: Date.now(),
      before: snapshotFromRow(card),
      reviewId: newUuid(),
      answer: giveUp ? '' : undefined,
    })
    // Stage 1: the student marks their own answer against the key points, starting unticked.
    dispatch({ type: 'marked', marking: selfMarking(card.key_points), grading: 'self' })
  }

  const toggle = (keyPointId: string) => dispatch({ type: 'toggle', keyPointId })
  const setEasy = (value: boolean) => dispatch({ type: 'easy', easy: value })

  const save = async () => {
    const { before, marking, reviewId } = state
    if (saving.current || state.phase !== 'marked' || !marking || !before || !reviewId || state.markedAt === null) return
    saving.current = true
    const handedInAt = state.markedAt
    dispatch({ type: 'save' })

    const send = (from: FsrsSnapshot, at: Date, marks: Marking) =>
      recordReview.mutateAsync(
        buildReviewInput({
          id: reviewId,
          cardId: card.id,
          before: from,
          marking: marks,
          easy: state.easy,
          answer: state.answer,
          grading: state.grading,
          now: at,
          retention,
          durationMs: handedInAt - shownAt,
        }),
      )

    try {
      let at = new Date(handedInAt)
      let result: RecordReviewResult
      try {
        result = await send(before, at, marking)
      } catch (error) {
        if (!hasErrorCode(error, CARD_CONFLICT_CODE)) throw error
        const fresh = await refreshCard(card.id)
        if (!fresh) throw CARD_GONE
        at = rescheduleTime(fresh, new Date())
        if (!marksKeyPoints(marking.results, fresh.key_points)) {
          dispatch({ type: 'cardChanged', at: at.getTime(), before: snapshotFromRow(fresh), keyPoints: fresh.key_points })
          onCardChanged()
          return
        }
        result = await send(snapshotFromRow(fresh), at, rebuildMarking(marking, fresh.key_points))
      }
      dispatch({ type: 'saved' })
      onSaved(result, at)
    } catch (error) {
      dispatch({ type: 'saveFailed' })
      onSaveFailed(error)
    } finally {
      saving.current = false
    }
  }

  return {
    phase: state.phase,
    answer: state.answer,
    results,
    score,
    fullMarks,
    easy,
    rating,
    markedAt,
    /** When the card would next be due with the marks as they stand, or null before marking. */
    nextDue: preview ? preview[rating] : null,
    unsaved: hasUnsavedWork(state),
    setAnswer,
    submit,
    toggle,
    setEasy,
    save,
  }
}

export type CardMarking = ReturnType<typeof useCardMarking>
