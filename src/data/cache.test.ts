import { afterEach, describe, expect, it } from 'vitest'
import { QueryObserver } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { CardRow, ReviewRow, TopicRow } from '../lib/database.types'
import {
  applyTopicOrder,
  createQueryClient,
  dueSessionOptions,
  onCardCreated,
  onCardDeleted,
  onCardUpdated,
  onReviewRecorded,
  onTopicDeleted,
} from './cache'
import { queryKeys } from './keys'

function card(id: string, overrides: Partial<CardRow> = {}): CardRow {
  return {
    id,
    user_id: 'user',
    subject: 'physics',
    topic_id: null,
    question: `Question ${id}`,
    key_points: [{ id: 'kp_a', point: 'A point', accept: [], reject: [] }],
    origin: 'manual',
    suspended: false,
    fsrs_state: 0,
    due: '2026-10-21T09:00:00.000Z',
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
    category: 'new',
    last_score: null,
    created_at: '2026-10-21T09:00:00.000Z',
    updated_at: '2026-10-21T09:00:00.000Z',
    ...overrides,
  }
}

function review(id: string, cardId: string): ReviewRow {
  return {
    id,
    user_id: 'user',
    card_id: cardId,
    reviewed_at: '2026-10-21T09:05:00.000Z',
    answer: '',
    grading: 'self',
    results: [],
    corrections: [],
    missing: [],
    points_hit: 1,
    points_total: 1,
    easy: false,
    rating: 3,
    card_before: {
      state: 0,
      due: '2026-10-21T09:00:00.000Z',
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      last_review: null,
    },
    duration_ms: null,
    amended_at: null,
  }
}

function topic(id: string, position: number, subject: TopicRow['subject'] = 'physics'): TopicRow {
  return { id, user_id: 'user', subject, name: `Topic ${id}`, unit: null, position, archived: false, created_at: '' }
}

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/**
 * A query with a component using it: loaded once, then counted every time it is fetched again.
 * `sequence` gives the data for each fetch in turn (the last one repeats).
 */
async function mounted<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  sequence: T[],
  options: object = {},
) {
  let fetches = 0
  const queryFn = async () => sequence[Math.min(fetches++, sequence.length - 1)] as T
  await queryClient.prefetchQuery({ queryKey, queryFn, ...options })
  const observer = new QueryObserver(queryClient, { queryKey, queryFn, ...options })
  cleanups.push(observer.subscribe(() => {}))
  return {
    get fetches() {
      return fetches
    },
    data: () => queryClient.getQueryData<T>(queryKey),
  }
}

function sessionOf(queryClient: QueryClient, cards: CardRow[][]) {
  return mounted(queryClient, queryKeys.dueSession(), cards, dueSessionOptions)
}

describe('onReviewRecorded', () => {
  it('updates the card everywhere except the running review session', async () => {
    const queryClient = createQueryClient()
    const [a, b] = [card('a'), card('b')]
    const reviewed = card('a', { fsrs_state: 1, reps: 1, category: 'learning', last_score: 1 })
    const session = await sessionOf(queryClient, [[a, b], [b]])
    const list = await mounted(queryClient, queryKeys.cardList(), [[a, b], [reviewed, b]])
    const summary = await mounted(queryClient, queryKeys.dueSummary(), [{ dueNow: 2 }, { dueNow: 1 }])
    const history = await mounted(queryClient, queryKeys.cardReviewsPage('a', 20), [[review('r0', 'a')]])

    await onReviewRecorded(queryClient, { review: review('r1', 'a'), card: reviewed })

    expect(session.fetches).toBe(1)
    expect(session.data()).toEqual([a, b])
    expect(list.data()).toEqual([reviewed, b])
    expect(queryClient.getQueryData(queryKeys.card('a'))).toEqual(reviewed)
    expect(summary.fetches).toBe(2)
    expect(summary.data()).toEqual({ dueNow: 1 })
    expect(history.data()?.map((r) => r.id)).toEqual(['r1', 'r0'])
  })

  it('updates the card and history before any refetch finishes', async () => {
    const queryClient = createQueryClient()
    const [a, reviewed] = [card('a'), card('a', { reps: 1 })]
    const list = await mounted(queryClient, queryKeys.cardList(), [[a], [reviewed]])
    const history = await mounted(queryClient, queryKeys.cardReviewsPage('a', 20), [[review('r0', 'a')]])

    const refetched = onReviewRecorded(queryClient, { review: review('r1', 'a'), card: reviewed })

    expect(list.data()).toEqual([reviewed])
    expect(queryClient.getQueryData(queryKeys.card('a'))).toEqual(reviewed)
    expect(history.data()?.map((r) => r.id)).toEqual(['r1', 'r0'])
    await refetched
  })

  it('replaces an overridden review in the history instead of adding it again', async () => {
    const queryClient = createQueryClient()
    const history = await mounted(queryClient, queryKeys.cardReviewsPage('a', 20), [[review('r1', 'a'), review('r0', 'a')]])
    const amended = { ...review('r1', 'a'), points_hit: 0, rating: 1 as const }
    await onReviewRecorded(queryClient, { review: amended, card: card('a') })
    expect(history.data()).toEqual([amended, review('r0', 'a')])
  })
})

describe('card changes', () => {
  it('refreshes an empty session when a card is created, but never a running one', async () => {
    const queryClient = createQueryClient()
    const empty = await mounted(queryClient, queryKeys.dueSession('maths'), [[], [card('new')]], dueSessionOptions)
    const running = await sessionOf(queryClient, [[card('a')], [card('a'), card('new')]])
    const list = await mounted(queryClient, queryKeys.cardList(), [[card('a')]])

    await onCardCreated(queryClient, card('new'))

    expect(empty.fetches).toBe(2)
    expect(empty.data()).toEqual([card('new')])
    expect(running.fetches).toBe(1)
    expect(running.data()).toEqual([card('a')])
    expect(list.data()?.map((c) => c.id)).toEqual(['new', 'a'])
    expect(list.fetches).toBe(1)
  })

  it('shows an edited card in place in a running session', async () => {
    const queryClient = createQueryClient()
    const session = await sessionOf(queryClient, [[card('a'), card('b'), card('c')]])
    const edited = card('b', { question: 'Reworded' })
    await onCardUpdated(queryClient, edited)
    expect(session.data()).toEqual([card('a'), edited, card('c')])
    expect(session.fetches).toBe(1)
  })

  it('updates the list, detail and session before any refetch finishes', async () => {
    const queryClient = createQueryClient()
    const session = await sessionOf(queryClient, [[card('a')]])
    const list = await mounted(queryClient, queryKeys.cardList(), [[card('a')]])
    const edited = card('a', { key_points: [{ id: 'kp_b', point: 'Changed elsewhere', accept: [], reject: [] }] })

    const refetched = onCardUpdated(queryClient, edited)

    expect(session.data()).toEqual([edited])
    expect(list.data()).toEqual([edited])
    expect(queryClient.getQueryData(queryKeys.card('a'))).toEqual(edited)
    await refetched
  })

  it('takes a deleted card out of the list and the session', async () => {
    const queryClient = createQueryClient()
    const session = await sessionOf(queryClient, [[card('a'), card('b')]])
    const list = await mounted(queryClient, queryKeys.cardList(), [[card('a'), card('b')]])
    queryClient.setQueryData(queryKeys.card('a'), card('a'))

    await onCardDeleted(queryClient, 'a')

    expect(session.data()).toEqual([card('b')])
    expect(list.data()).toEqual([card('b')])
    expect(queryClient.getQueryData(queryKeys.card('a'))).toBeUndefined()
    expect(session.fetches).toBe(1)
  })
})

describe('topics', () => {
  it('detaches cards from a deleted topic without refetching the session', async () => {
    const queryClient = createQueryClient()
    const inTopic = card('a', { topic_id: 't1' })
    const session = await sessionOf(queryClient, [[inTopic]])
    await mounted(queryClient, queryKeys.topics(), [[topic('t1', 0)], []])

    await onTopicDeleted(queryClient, 't1')

    expect(session.data()).toEqual([{ ...inTopic, topic_id: null }])
    expect(session.fetches).toBe(1)
    expect(queryClient.getQueryData(queryKeys.topics())).toEqual([])
  })

  it('applies a new order to one subject and returns the old topics', () => {
    const queryClient = createQueryClient()
    const topics = [topic('m1', 0, 'maths'), topic('p1', 0), topic('p2', 1), topic('p3', 2)]
    queryClient.setQueryData(queryKeys.topics(), topics)

    expect(applyTopicOrder(queryClient, 'physics', ['p3', 'p1', 'p2'])).toBe(topics)
    expect(queryClient.getQueryData<TopicRow[]>(queryKeys.topics())?.map((t) => [t.id, t.position])).toEqual([
      ['m1', 0],
      ['p3', 0],
      ['p1', 1],
      ['p2', 2],
    ])
  })
})
