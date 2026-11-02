import { describe, expect, it } from 'vitest'
import {
  advance,
  createQueue,
  dropNoLongerDue,
  DUE_GRACE_MS,
  heldCards,
  isFinished,
  isLastQueued,
  queueProgress,
  reconcileQueue,
  REQUEUE_WINDOW_MS,
  requeueAt,
  skipCurrent,
  syncRequeue,
  type ReviewQueue,
} from './queue'

const NOW = Date.parse('2026-10-23T10:00:00Z')
const MINUTE = 60_000
/** A time some minutes from now. */
const later = (minutes: number) => NOW + minutes * MINUTE

const ids = (queue: ReviewQueue) => ({
  done: queue.done.map((e) => e.key),
  current: queue.current?.key ?? null,
  upcoming: queue.upcoming.map((e) => e.key),
})

/** Saves the card on screen, with it not coming back. */
const next = (queue: ReviewQueue, now = NOW) => advance(queue, { notBefore: null, now })
/** Saves the card on screen, with it coming back in `minutes`. */
const miss = (queue: ReviewQueue, minutes = 10, now = NOW) => advance(queue, { notBefore: later(minutes), now })

describe('createQueue', () => {
  it('starts on the first card with the rest to come', () => {
    expect(ids(createQueue(['a', 'b', 'c']))).toEqual({ done: [], current: 'a#0', upcoming: ['b#0', 'c#0'] })
  })

  it('marks every entry as a first appearance', () => {
    const queue = createQueue(['a', 'b'])
    expect([queue.current, ...queue.upcoming].map((e) => e?.notBefore)).toEqual([null, null])
  })

  it('ignores duplicate ids', () => {
    expect(ids(createQueue(['a', 'b', 'a']))).toEqual({ done: [], current: 'a#0', upcoming: ['b#0'] })
  })

  it('is finished straight away with no cards', () => {
    const queue = createQueue([])
    expect(queue.current).toBeNull()
    expect(isFinished(queue)).toBe(true)
    expect(queueProgress(queue)).toEqual({ position: 0, total: 0, completed: 0 })
  })
})

describe('advance', () => {
  it('moves to the next card and counts the current one as done', () => {
    const queue = next(createQueue(['a', 'b']))
    expect(ids(queue)).toEqual({ done: ['a#0'], current: 'b#0', upcoming: [] })
    expect(queueProgress(queue)).toEqual({ position: 2, total: 2, completed: 1 })
    expect(isLastQueued(queue, NOW)).toBe(true)
  })

  it('finishes after the last card', () => {
    const queue = next(next(createQueue(['a', 'b'])))
    expect(isFinished(queue)).toBe(true)
    expect(queueProgress(queue)).toEqual({ position: 2, total: 2, completed: 2 })
  })

  it('brings a card back with a new key and the time it is due', () => {
    const queue = miss(createQueue(['a', 'b', 'c']))
    expect(ids(queue)).toEqual({ done: ['a#0'], current: 'b#0', upcoming: ['c#0', 'a#1'] })
    expect(queue.upcoming[1]?.notBefore).toBe(later(10))
  })

  it('finishes the session when the only card left is not due yet, keeping it held', () => {
    const queue = miss(createQueue(['a']))
    expect(isFinished(queue)).toBe(true)
    expect(ids(queue)).toEqual({ done: ['a#0'], current: null, upcoming: ['a#1'] })
  })

  it('shows a returning card once it is due, and finishes once nothing comes back', () => {
    let queue = miss(createQueue(['a', 'b']))
    queue = next(queue, later(11))
    expect(ids(queue)).toEqual({ done: ['a#0', 'b#0'], current: 'a#1', upcoming: [] })
    queue = miss(queue, 21, later(11))
    expect(queue.current).toBeNull()
    expect(queue.upcoming.map((e) => [e.key, e.notBefore])).toEqual([['a#2', later(21)]])
    expect(queue.done.map((e) => e.round)).toEqual([0, 0, 1])
  })

  it('may show a returning card up to a minute before it is due, and no sooner', () => {
    const queue = miss(createQueue(['a', 'b']), 10)
    expect(next(queue, later(10) - DUE_GRACE_MS).current?.key).toBe('a#1')
    expect(next(queue, later(10) - DUE_GRACE_MS - 1).current).toBeNull()
  })

  it('shows first appearances before returning cards, even ones already due', () => {
    let queue = miss(createQueue(['a', 'b', 'c']), 1)
    queue = next(queue, later(5))
    expect(queue.current?.key).toBe('c#0')
  })

  it('orders returning cards by when they are due, not when they were marked', () => {
    let queue = miss(createQueue(['a', 'b', 'c']), 15)
    queue = miss(queue, 10)
    queue = next(queue, later(20))
    expect(ids(queue)).toEqual({ done: ['a#0', 'b#0', 'c#0'], current: 'b#1', upcoming: ['a#1'] })
    expect(next(queue, later(20)).current?.key).toBe('a#1')
  })

  it('does not queue a card twice', () => {
    // 'a' is on screen, so syncRequeue leaves it; saving it adds it once.
    let queue = syncRequeue(createQueue(['a', 'b']), 'a', later(10))
    queue = miss(queue)
    queue = next(queue, later(11))
    expect(ids(queue)).toEqual({ done: ['a#0', 'b#0'], current: 'a#1', upcoming: [] })
  })

  it('leaves a finished queue alone', () => {
    const finished = createQueue([])
    expect(miss(finished)).toBe(finished)
  })
})

describe('isLastQueued', () => {
  it('is true when nothing follows', () => {
    expect(isLastQueued(createQueue(['a']), NOW)).toBe(true)
  })

  it('is false while first appearances are to come', () => {
    expect(isLastQueued(createQueue(['a', 'b']), NOW)).toBe(false)
  })

  it('takes the clock into account for returning cards', () => {
    const queue = miss(createQueue(['a', 'b']))
    expect(queue.current?.key).toBe('b#0')
    expect(isLastQueued(queue, NOW)).toBe(true)
    expect(isLastQueued(queue, later(10) - DUE_GRACE_MS - 1)).toBe(true)
    expect(isLastQueued(queue, later(10) - DUE_GRACE_MS)).toBe(false)
  })

  it('is false once the session is over', () => {
    expect(isLastQueued(next(createQueue(['a'])), NOW)).toBe(false)
  })
})

describe('queueProgress', () => {
  it('does not count a held card in the total', () => {
    const queue = miss(createQueue(['a', 'b', 'c']))
    expect(queueProgress(queue)).toEqual({ position: 2, total: 3, completed: 1 })
  })

  it('counts a returning card once it is on screen', () => {
    const queue = next(next(miss(createQueue(['a', 'b', 'c']))), later(11))
    expect(queue.current?.key).toBe('a#1')
    expect(queueProgress(queue)).toEqual({ position: 4, total: 4, completed: 3 })
  })

  it('never ends short of its total, however many cards are held', () => {
    let queue = createQueue(['a', 'b', 'c'])
    queue = miss(queue)
    queue = miss(queue)
    queue = miss(queue)
    expect(isFinished(queue)).toBe(true)
    expect(queueProgress(queue)).toEqual({ position: 3, total: 3, completed: 3 })
  })
})

describe('heldCards', () => {
  it('is empty without returning cards', () => {
    expect(heldCards(createQueue(['a', 'b']))).toEqual({ count: 0, soonest: null })
  })

  it('counts the returning cards and finds the soonest', () => {
    let queue = createQueue(['a', 'b', 'c'])
    queue = miss(queue, 15)
    queue = next(queue)
    queue = miss(queue, 8)
    expect(isFinished(queue)).toBe(true)
    expect(heldCards(queue)).toEqual({ count: 2, soonest: later(8) })
  })

  it('counts only returning cards while the session is running', () => {
    expect(heldCards(miss(createQueue(['a', 'b', 'c'])))).toEqual({ count: 1, soonest: later(10) })
  })
})

describe('requeueAt', () => {
  const now = new Date(NOW)

  it('brings back cards due within the window, at the time they are due', () => {
    expect(requeueAt(new Date(later(1)), now)).toBe(later(1))
    expect(requeueAt(new Date(later(10)), now)).toBe(later(10))
    expect(requeueAt(new Date(NOW + REQUEUE_WINDOW_MS), now)).toBe(NOW + REQUEUE_WINDOW_MS)
  })

  it('lets cards due later go', () => {
    expect(requeueAt(new Date(NOW + REQUEUE_WINDOW_MS + 1), now)).toBeNull()
    expect(requeueAt('2026-10-26T10:00:00Z', now)).toBeNull()
  })

  it('accepts ISO strings and ignores invalid dates', () => {
    expect(requeueAt('2026-10-23T10:05:00.000Z', now)).toBe(later(5))
    expect(requeueAt('not a date', now)).toBeNull()
  })
})

describe('skipCurrent', () => {
  it('drops the card on screen without counting it', () => {
    const queue = skipCurrent(createQueue(['a', 'b']), NOW)
    expect(ids(queue)).toEqual({ done: [], current: 'b#0', upcoming: [] })
    expect(queueProgress(queue)).toEqual({ position: 1, total: 1, completed: 0 })
  })

  it('moves on to a returning card only when it is ready', () => {
    const queue = miss(createQueue(['a', 'b']))
    expect(skipCurrent(queue, NOW).current).toBeNull()
    expect(skipCurrent(queue, later(11)).current?.key).toBe('a#1')
  })
})

describe('reconcileQueue', () => {
  const exceptB = (id: string) => id !== 'b'

  it('returns the same queue when every card still exists', () => {
    const queue = createQueue(['a', 'b'])
    expect(reconcileQueue(queue, () => true, NOW)).toBe(queue)
  })

  it('removes deleted cards still to come', () => {
    const queue = reconcileQueue(createQueue(['a', 'b', 'c']), exceptB, NOW)
    expect(ids(queue)).toEqual({ done: [], current: 'a#0', upcoming: ['c#0'] })
  })

  it('removes a deleted card that was held', () => {
    const queue = reconcileQueue(miss(createQueue(['b', 'a'])), exceptB, NOW)
    expect(ids(queue)).toEqual({ done: ['b#0'], current: 'a#0', upcoming: [] })
  })

  it('moves on when the card on screen was deleted', () => {
    const queue = reconcileQueue(next(createQueue(['a', 'b', 'c'])), exceptB, NOW)
    expect(ids(queue)).toEqual({ done: ['a#0'], current: 'c#0', upcoming: [] })
  })

  it('does not bring a held card forward when the card on screen was deleted', () => {
    const queue = miss(createQueue(['a', 'b']))
    expect(ids(reconcileQueue(queue, exceptB, NOW))).toEqual({ done: ['a#0'], current: null, upcoming: ['a#1'] })
    expect(reconcileQueue(queue, exceptB, later(11)).current?.key).toBe('a#1')
  })

  it('keeps done cards even if they were deleted since', () => {
    const queue = reconcileQueue(next(createQueue(['a', 'b'])), (id) => id !== 'a', NOW)
    expect(ids(queue)).toEqual({ done: ['a#0'], current: 'b#0', upcoming: [] })
  })

  it('finishes when nothing is left', () => {
    expect(isFinished(reconcileQueue(createQueue(['a']), () => false, NOW))).toBe(true)
  })
})

describe('dropNoLongerDue', () => {
  it('drops first appearances that are no longer due', () => {
    const queue = dropNoLongerDue(createQueue(['a', 'b', 'c']), (id) => id !== 'b')
    expect(ids(queue)).toEqual({ done: [], current: 'a#0', upcoming: ['c#0'] })
    expect(queueProgress(queue)).toEqual({ position: 1, total: 2, completed: 0 })
  })

  it('never touches the card on screen', () => {
    expect(ids(dropNoLongerDue(createQueue(['a', 'b']), () => false))).toEqual({ done: [], current: 'a#0', upcoming: [] })
  })

  it('never touches held returning cards', () => {
    const queue = miss(createQueue(['a', 'b', 'c']))
    expect(ids(dropNoLongerDue(queue, () => false))).toEqual({ done: ['a#0'], current: 'b#0', upcoming: ['a#1'] })
  })

  it('returns the same queue when nothing changes', () => {
    const queue = createQueue(['a', 'b'])
    expect(dropNoLongerDue(queue, () => true)).toBe(queue)
  })
})

describe('syncRequeue', () => {
  it('adds a card that is now due soon, holding it until then', () => {
    let queue = next(createQueue(['a', 'b']))
    queue = syncRequeue(queue, 'a', later(10))
    expect(ids(queue)).toEqual({ done: ['a#0'], current: 'b#0', upcoming: ['a#1'] })
    expect(queue.upcoming[0]?.notBefore).toBe(later(10))
    expect(queueProgress(queue).total).toBe(2)
  })

  it('updates when a held card comes back', () => {
    const queue = syncRequeue(miss(createQueue(['a', 'b'])), 'a', later(15))
    expect(ids(queue)).toEqual({ done: ['a#0'], current: 'b#0', upcoming: ['a#1'] })
    expect(queue.upcoming[0]?.notBefore).toBe(later(15))
  })

  it('removes a card that is no longer due soon', () => {
    let queue = miss(createQueue(['a', 'b']))
    expect(queue.upcoming.map((e) => e.key)).toEqual(['a#1'])
    queue = syncRequeue(queue, 'a', null)
    expect(ids(queue)).toEqual({ done: ['a#0'], current: 'b#0', upcoming: [] })
  })

  it('returns the same queue when nothing changes', () => {
    const queue = miss(createQueue(['a', 'b']))
    expect(syncRequeue(queue, 'a', later(10))).toBe(queue)
    expect(syncRequeue(queue, 'b', later(10))).toBe(queue)
    expect(syncRequeue(queue, 'c', null)).toBe(queue)
  })

  it('leaves a first appearance alone', () => {
    const queue = createQueue(['a', 'b'])
    expect(syncRequeue(queue, 'b', later(10))).toBe(queue)
    expect(syncRequeue(queue, 'b', null)).toBe(queue)
  })

  it('keeps a finished session finished, with its held cards up to date', () => {
    const finished = next(next(createQueue(['a', 'b'])))
    const held = syncRequeue(finished, 'a', later(10))
    expect(isFinished(held)).toBe(true)
    expect(heldCards(held)).toEqual({ count: 1, soonest: later(10) })

    const moved = syncRequeue(held, 'a', later(15))
    expect(isFinished(moved)).toBe(true)
    expect(heldCards(moved)).toEqual({ count: 1, soonest: later(15) })

    const cleared = syncRequeue(moved, 'a', null)
    expect(isFinished(cleared)).toBe(true)
    expect(heldCards(cleared)).toEqual({ count: 0, soonest: null })
  })

  it('leaves a finished session finished even when the card is already due', () => {
    const finished = next(createQueue(['a']))
    expect(isFinished(syncRequeue(finished, 'a', later(-5)))).toBe(true)
  })
})
