// A review session: the due-card snapshot, the queue through it, and what was saved.
//
// The snapshot comes from useDueCards (it never reshuffles mid-session). Cards are looked up by
// id: an edit made elsewhere shows up in place, a card deleted elsewhere drops out of the queue.
// A card's schedule is taken from whichever copy is newer, the snapshot or what this session
// saved, so a card that comes back later in the session is scheduled from its latest state.

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import type { RecordReviewResult } from '../../data/api'
import { useDueCards, useFetchDueCards, useProfile, useTopics } from '../../data/hooks'
import type { CardRow } from '../../lib/database.types'
import { DEFAULT_RETENTION } from '../../lib/fsrs'
import type { SubjectCode } from '../../lib/types'
import {
  advance,
  createQueue,
  dropNoLongerDue,
  DUE_GRACE_MS,
  heldCards,
  isLastQueued,
  queueProgress,
  reconcileQueue,
  requeueAt,
  skipCurrent,
  syncRequeue,
  type HeldCards,
  type QueueEntry,
  type QueueProgress,
  type ReviewQueue,
} from './queue'
import { replaceRecord, type SessionRecord } from './sessionRecords'

/** Hidden for this long, the session's picture of what is still due is worth checking. */
const STALE_AFTER_MS = 10 * 60_000

interface SessionState {
  queue: ReviewQueue
  /** Cards as this session saved them (newer than the snapshot's copy). */
  saved: Record<string, CardRow>
  records: SessionRecord[]
}

export type SessionStatus = 'loading' | 'error' | 'empty' | 'active' | 'finished'

export interface CurrentCard {
  entry: QueueEntry
  card: CardRow
  /** The card's number in the session, from 1. */
  number: number
}

function newer(snapshot: CardRow | undefined, saved: CardRow | undefined): CardRow | undefined {
  if (!snapshot) return saved
  if (!saved) return snapshot
  return Date.parse(saved.updated_at) >= Date.parse(snapshot.updated_at) ? saved : snapshot
}

function freshSession(cards: readonly CardRow[]): SessionState {
  return { queue: createQueue(cards.map((card) => card.id)), saved: {}, records: [] }
}

export function useReviewSession(subject?: SubjectCode) {
  const due = useDueCards({ subject })
  const { refetch } = due
  const fetchDueCards = useFetchDueCards()
  const profile = useProfile()
  const topics = useTopics()
  const retention = profile.data?.desired_retention ?? DEFAULT_RETENTION

  // Null until something happens: until then the session is derived from the snapshot, so a
  // card edited before the first answer still shows its latest content.
  const [stored, setStored] = useState<SessionState | null>(null)
  const [restarting, setRestarting] = useState(false)
  // The clock for rendering: what is ready depends on it. See the timer below.
  const [now, setNow] = useState(() => Date.now())

  const snapshot = due.data
  const byId = useMemo(() => new Map((snapshot ?? []).map((card) => [card.id, card])), [snapshot])
  const exists = useCallback((id: string) => byId.has(id), [byId])

  const derived = useMemo(() => (snapshot ? freshSession(snapshot) : null), [snapshot])
  const base = stored ?? derived
  const session = useMemo(
    () => (base ? { ...base, queue: reconcileQueue(base.queue, exists, now) } : null),
    [base, exists, now],
  )

  // While a card is on screen, look again when the next returning card is ready, so the button
  // turns from "Finish" to "Next card". A session already over stays over.
  const nextReturning = session?.queue.current ? heldCards(session.queue).soonest : null
  useEffect(() => {
    if (nextReturning === null) return
    const wait = Math.max(nextReturning - DUE_GRACE_MS - Date.now(), 0)
    const timer = window.setTimeout(() => setNow(Date.now()), wait)
    return () => window.clearTimeout(timer)
  }, [nextReturning])

  const cardFor = useCallback(
    (id: string) => newer(byId.get(id), session?.saved[id]),
    [byId, session?.saved],
  )

  const topicNames = useMemo(() => new Map((topics.data ?? []).map((topic) => [topic.id, topic.name])), [topics.data])
  const topicName = useCallback((id: string | null) => (id ? (topicNames.get(id) ?? null) : null), [topicNames])

  let status: SessionStatus
  if (!session) status = due.isError ? 'error' : 'loading'
  else if (session.queue.current) status = 'active'
  else status = session.records.length > 0 ? 'finished' : 'empty'

  const progress: QueueProgress = session ? queueProgress(session.queue) : { position: 0, total: 0, completed: 0 }
  const currentEntry = session?.queue.current ?? null
  const currentCard = currentEntry ? cardFor(currentEntry.cardId) : undefined
  const current: CurrentCard | null =
    currentEntry && currentCard ? { entry: currentEntry, card: currentCard, number: progress.position } : null

  /** Applies a change to the session as it is now (stored, or derived from the snapshot). */
  const update = (change: (state: SessionState, at: number) => SessionState) => {
    const at = Date.now()
    setStored((previous) => {
      const from = previous ?? base
      if (!from) return previous
      return change({ ...from, queue: reconcileQueue(from.queue, exists, at) }, at)
    })
  }

  // Back after a long time away: the cards still to come may have been reviewed on another device.
  // Those drop out. The snapshot stays as it is, and so do the card on screen and held cards.
  const dropReviewedElsewhere = useEffectEvent((dueNow: readonly CardRow[]) => {
    const ids = new Set(dueNow.map((card) => card.id))
    update((state) => ({ ...state, queue: dropNoLongerDue(state.queue, (id) => ids.has(id)) }))
  })
  const onReturn = useEffectEvent(() => {
    if (!session?.queue.current) return
    fetchDueCards(subject).then(
      (cards) => dropReviewedElsewhere(cards),
      () => {},
    )
  })
  useEffect(() => {
    let hiddenAt = document.hidden ? Date.now() : null
    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt ??= Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= STALE_AFTER_MS) onReturn()
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  /**
   * The card on screen was saved. It moves to the done pile and, when FSRS has it due again
   * within the requeue window (measured from when it was marked), waits to come back then.
   * Returns the session record for it.
   */
  const complete = (entry: QueueEntry, result: RecordReviewResult, markedAt: Date): SessionRecord => {
    const record: SessionRecord = { key: entry.key, cardId: entry.cardId, review: result.review, card: result.card }
    update((state, at) => {
      if (state.queue.current?.key !== entry.key) return state
      return {
        queue: advance(state.queue, { notBefore: requeueAt(result.card.due, markedAt), now: at }),
        saved: { ...state.saved, [entry.cardId]: result.card },
        records: [...state.records, record],
      }
    })
    return record
  }

  /** Skips the card on screen without saving (it was deleted, or changed and left, elsewhere). */
  const skip = (entry: QueueEntry) => {
    update((state, at) => (state.queue.current?.key === entry.key ? { ...state, queue: skipCurrent(state.queue, at) } : state))
  }

  /** A saved answer's marks were changed: update the record, the card and the queue. */
  const amend = (recordKey: string, result: RecordReviewResult) => {
    update((state, at) => {
      const saved = newer(state.saved[result.card.id], result.card) ?? result.card
      return {
        queue: syncRequeue(state.queue, result.card.id, requeueAt(result.card.due, new Date(at))),
        saved: { ...state.saved, [result.card.id]: saved },
        records: replaceRecord(state.records, recordKey, { review: result.review, card: result.card }),
      }
    })
  }

  /** Loads the due cards again (after an error, or when one comes due on the empty screen). */
  const retry = useCallback(() => void refetch(), [refetch])

  /**
   * Starts a new session over whatever is due now. Resolves to the error if that failed to load
   * (the finished session stays on screen), or null.
   */
  const restart = async (): Promise<unknown> => {
    setRestarting(true)
    try {
      const result = await refetch()
      if (result.isError) return result.error
      setStored(null)
      return null
    } finally {
      setRestarting(false)
    }
  }

  const held: HeldCards = session ? heldCards(session.queue) : { count: 0, soonest: null }

  return {
    status,
    error: due.error,
    retry,
    retrying: due.isFetching,
    retention,
    topicName,
    current,
    progress,
    /** Nothing that follows the card on screen is ready, so the session ends with it. */
    lastQueued: session ? isLastQueued(session.queue, now) : false,
    /** Returning cards waiting to come due; once the session is over, the ones it left behind. */
    held,
    records: session?.records ?? [],
    complete,
    skip,
    amend,
    restart,
    restarting,
  }
}

export type ReviewSession = ReturnType<typeof useReviewSession>
