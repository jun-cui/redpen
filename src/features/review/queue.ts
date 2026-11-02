// The review session's queue: which card is on screen, which are still to come, and which are
// done. Pure functions over plain data, so the rules are unit-tested (queue.test.ts).
//
// Cards are keyed by id, never by index. A card can come up more than once in a session: an FSRS
// learning step brings it back within minutes after a miss, so after saving, a card due again
// within REQUEUE_WINDOW_MS joins the queue with the time it is due. It waits for that time:
// asking again seconds after the mark scheme was on screen would test nothing. Each appearance
// is its own entry with a unique key, which keys the card on screen.
//
// What is ready depends on the clock, so everything that picks the next card takes `now`. When
// only returning cards that aren't ready are left, the session is over. They stay in `upcoming`
// as held cards (see heldCards), and "Keep going" on the summary picks them up once they are due.

/** A card due again within this long after it is marked comes back later in the same session. */
export const REQUEUE_WINDOW_MS = 20 * 60_000

/** A returning card may be shown this long before it is due. */
export const DUE_GRACE_MS = 60_000

export interface QueueEntry {
  /** Unique per appearance (`${cardId}#${round}`): keys the card on screen. */
  key: string
  cardId: string
  /** 0 the first time the card comes up in the session, 1 the second time, and so on. */
  round: number
  /** When a returning card is due (ms since the epoch); null for a card's first appearance. */
  notBefore: number | null
}

export interface ReviewQueue {
  /** Entries already marked and saved, in order. */
  done: QueueEntry[]
  /** The entry on screen, or null when the session is over. */
  current: QueueEntry | null
  /** Entries still to come: first appearances in order, and returning cards waiting to be due. */
  upcoming: QueueEntry[]
}

export interface QueueProgress {
  /** 1-based number of the card on screen; once the session is over, the number completed. */
  position: number
  /** Done, on screen and first appearances still to come. A returning card counts once shown. */
  total: number
  /** Entries marked and saved so far. */
  completed: number
}

export interface HeldCards {
  /** Returning cards waiting in the queue. */
  count: number
  /** When the first of them is due (ms since the epoch), or null with none. It can be past. */
  soonest: number | null
}

function entryFor(cardId: string, round: number, notBefore: number | null): QueueEntry {
  return { key: `${cardId}#${round}`, cardId, round, notBefore }
}

function allEntries(queue: ReviewQueue): QueueEntry[] {
  return queue.current ? [...queue.done, queue.current, ...queue.upcoming] : [...queue.done, ...queue.upcoming]
}

function isReady(entry: QueueEntry, now: number): boolean {
  return entry.notBefore === null || entry.notBefore - DUE_GRACE_MS <= now
}

/** The next card from `upcoming`: first appearances in order, then returning cards, soonest due first. */
function nextReady(upcoming: readonly QueueEntry[], now: number): QueueEntry | null {
  const [next] = upcoming.filter((entry) => isReady(entry, now)).sort((a, b) => (a.notBefore ?? 0) - (b.notBefore ?? 0))
  return next ?? null
}

/** Puts the next ready card on screen; with none, the session is over and the rest stay held. */
function moveOn(done: QueueEntry[], upcoming: QueueEntry[], now: number): ReviewQueue {
  const next = nextReady(upcoming, now)
  return { done, current: next, upcoming: upcoming.filter((entry) => entry !== next) }
}

/** A new session over the given cards, in the given order. Duplicate ids are ignored. */
export function createQueue(cardIds: readonly string[]): ReviewQueue {
  const [first, ...rest] = [...new Set(cardIds)].map((id) => entryFor(id, 0, null))
  return { done: [], current: first ?? null, upcoming: rest }
}

export function isFinished(queue: ReviewQueue): boolean {
  return queue.current === null
}

/** Whether the card on screen is the last one for now: nothing that follows is ready. */
export function isLastQueued(queue: ReviewQueue, now: number): boolean {
  return queue.current !== null && nextReady(queue.upcoming, now) === null
}

/** "3 of 12": the card on screen and the session's length so far. Held cards don't count yet. */
export function queueProgress(queue: ReviewQueue): QueueProgress {
  const completed = queue.done.length
  const toCome = queue.upcoming.filter((entry) => entry.notBefore === null).length
  const total = completed + (queue.current ? 1 : 0) + toCome
  return { position: queue.current ? completed + 1 : completed, total, completed }
}

/** The returning cards waiting in the queue, for the end of the session. */
export function heldCards(queue: ReviewQueue): HeldCards {
  const times = queue.upcoming.flatMap((entry) => (entry.notBefore === null ? [] : [entry.notBefore]))
  return { count: times.length, soonest: times.length > 0 ? Math.min(...times) : null }
}

/** When a card now due at `due` should come back in this session, or null if it shouldn't. */
export function requeueAt(due: Date | string, now: Date, windowMs: number = REQUEUE_WINDOW_MS): number | null {
  const time = typeof due === 'string' ? Date.parse(due) : due.getTime()
  return Number.isFinite(time) && time - now.getTime() <= windowMs ? time : null
}

function nextRound(queue: ReviewQueue, cardId: string): number {
  return allEntries(queue).reduce((max, entry) => (entry.cardId === cardId ? Math.max(max, entry.round + 1) : max), 0)
}

/**
 * Moves past the card on screen once it is saved. With `notBefore` (from requeueAt), the same
 * card comes back once it is due (unless it is already waiting).
 */
export function advance(
  queue: ReviewQueue,
  { notBefore, now }: { notBefore: number | null; now: number },
): ReviewQueue {
  const { current } = queue
  if (!current) return queue
  const waiting = queue.upcoming.some((entry) => entry.cardId === current.cardId)
  const upcoming =
    notBefore !== null && !waiting
      ? [...queue.upcoming, entryFor(current.cardId, nextRound(queue, current.cardId), notBefore)]
      : queue.upcoming
  return moveOn([...queue.done, current], upcoming, now)
}

/** Drops the card on screen without counting it as done (e.g. it was deleted elsewhere). */
export function skipCurrent(queue: ReviewQueue, now: number): ReviewQueue {
  if (!queue.current) return queue
  return moveOn(queue.done, queue.upcoming, now)
}

/**
 * Removes cards that no longer exist (deleted elsewhere) from what is still to come, including
 * the card on screen. Returns the same object when nothing changes, so it is cheap to run on
 * every render.
 */
export function reconcileQueue(queue: ReviewQueue, exists: (cardId: string) => boolean, now: number): ReviewQueue {
  const upcoming = queue.upcoming.filter((entry) => exists(entry.cardId))
  const currentGone = queue.current !== null && !exists(queue.current.cardId)
  if (!currentGone && upcoming.length === queue.upcoming.length) return queue
  if (!currentGone) return { ...queue, upcoming }
  return moveOn(queue.done, upcoming, now)
}

/**
 * After coming back to a stale session: drops first appearances still waiting that are no longer
 * due (reviewed on another device). The card on screen and returning cards are left alone.
 * Returns the same object when nothing changes.
 */
export function dropNoLongerDue(queue: ReviewQueue, stillDue: (cardId: string) => boolean): ReviewQueue {
  const upcoming = queue.upcoming.filter((entry) => entry.notBefore !== null || stillDue(entry.cardId))
  return upcoming.length === queue.upcoming.length ? queue : { ...queue, upcoming }
}

/**
 * After a saved card's marks are changed: sets, updates or removes the time it comes back
 * (`notBefore`, from requeueAt; null when it no longer does). The card on screen is left alone,
 * and a finished session stays finished, with its held cards up to date.
 */
export function syncRequeue(queue: ReviewQueue, cardId: string, notBefore: number | null): ReviewQueue {
  const waiting = queue.upcoming.find((entry) => entry.cardId === cardId)
  if (waiting?.notBefore === null) return queue
  if (notBefore === null) {
    if (!waiting) return queue
    return { ...queue, upcoming: queue.upcoming.filter((entry) => entry !== waiting) }
  }
  if (waiting) {
    if (waiting.notBefore === notBefore) return queue
    return { ...queue, upcoming: queue.upcoming.map((entry) => (entry === waiting ? { ...entry, notBefore } : entry)) }
  }
  if (queue.current?.cardId === cardId) return queue
  return { ...queue, upcoming: [...queue.upcoming, entryFor(cardId, nextRound(queue, cardId), notBefore)] }
}
