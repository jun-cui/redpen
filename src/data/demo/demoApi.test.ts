import { beforeEach, describe, expect, it } from 'vitest'
import type { CardRow } from '../../lib/database.types'
import { CARD_CONFLICT_CODE, friendlyError } from '../../lib/errors'
import { ratingFromScore, scheduleNext, snapshotFromRow } from '../../lib/fsrs'
import { scoreOf } from '../../lib/scoring'
import type { FsrsSnapshot, KeyPoint, PointResult } from '../../lib/types'
import type { Api, RecordReviewInput } from '../api'
import { DEFAULT_TOPICS, EXAMPLE_CARDS } from '../exampleContent'
import type { DemoState } from './db'
import { createDemoApi, DEMO_STORAGE_KEY } from './demoApi'
import type { DemoApiOptions } from './demoApi'
import { memoryStorage } from './storage'
import type { StorageLike } from './storage'

const START = new Date('2026-10-21T09:00:00.000Z')
let clock = new Date(START)

function setup(options: DemoApiOptions = {}) {
  const storage = options.storage ?? memoryStorage()
  const api = createDemoApi({
    storage,
    latencyMs: [0, 0],
    exampleCards: false,
    now: () => new Date(clock),
    ...options,
  })
  const state = (): DemoState => JSON.parse(storage.getItem(DEMO_STORAGE_KEY) ?? 'null') as DemoState
  return { api, storage, state }
}

const KEY_POINTS: KeyPoint[] = [
  { id: 'kp_one', point: 'Energy cannot be created or destroyed', accept: [], reject: [] },
  { id: 'kp_two', point: 'It can only be transferred between stores', accept: ['changes form'], reject: [] },
  { id: 'kp_three', point: 'Total energy of a closed system is constant', accept: [], reject: [] },
]

function makeCard(api: Api, overrides: Partial<Parameters<Api['createCard']>[0]> = {}) {
  return api.createCard({
    subject: 'physics',
    topic_id: null,
    question: 'State the principle of conservation of energy.',
    key_points: KEY_POINTS,
    ...overrides,
  })
}

function resultsFor(card: CardRow, hits: boolean[], extra: Partial<PointResult>[] = []): PointResult[] {
  return card.key_points.map((kp, i) => ({
    key_point_id: kp.id,
    point: kp.point,
    quote: null,
    reason: null,
    hit: hits[i] ?? false,
    ai_hit: null,
    overridden: false,
    ...extra[i],
  }))
}

interface ReviewOptions {
  easy?: boolean
  at?: Date
  after?: Partial<FsrsSnapshot>
  extra?: Partial<PointResult>[]
  input?: Partial<RecordReviewInput>
}

/** Marks `card` the way the review screen does: score -> rating -> FSRS -> record_review. */
function review(api: Api, card: CardRow, hits: boolean[], options: ReviewOptions = {}) {
  const at = options.at ?? clock
  const results = resultsFor(card, hits, options.extra)
  const { hit, total } = scoreOf(results)
  const rating = ratingFromScore(hit, total, options.easy)
  return api.recordReview({
    card_id: card.id,
    results,
    card_after: { ...scheduleNext(snapshotFromRow(card), rating, at), ...options.after },
    rating,
    easy: options.easy,
    answer: 'My answer',
    reviewed_at: at.toISOString(),
    ...options.input,
  })
}

const later = (minutes: number) => new Date(START.getTime() + minutes * 60_000)

beforeEach(() => {
  clock = new Date(START)
})

describe('seeding', () => {
  it('copies the default topics in order', async () => {
    const { api } = setup()
    const topics = await api.listTopics()
    for (const [subject, defaults] of Object.entries(DEFAULT_TOPICS)) {
      const seeded = topics.filter((t) => t.subject === subject)
      expect(seeded.map((t) => [t.name, t.unit, t.position])).toEqual(
        defaults.map((d, i) => [d.name, d.unit, i]),
      )
    }
  })

  it('adds the example cards with their topics resolved by name', async () => {
    const { api } = setup({ exampleCards: true })
    const [cards, topics] = await Promise.all([api.listCards(), api.listTopics()])
    expect(cards).toHaveLength(EXAMPLE_CARDS.length)
    for (const example of EXAMPLE_CARDS) {
      const card = cards.find((c) => c.question === example.question)
      const topic = topics.find((t) => t.id === card?.topic_id)
      expect(card?.origin).toBe('example')
      expect(card?.category).toBe('new')
      expect(topic?.subject).toBe(example.subject)
      expect(topic?.name.toLowerCase()).toBe(example.topic.toLowerCase())
    }
    // Newest first, so the first written example is last.
    expect(cards.at(-1)?.question).toBe(EXAMPLE_CARDS[0]?.question)
    expect(await api.addExampleCards()).toBe(0)
  })

  it('adds the example cards once', async () => {
    const { api } = setup()
    expect(await api.addExampleCards()).toBe(EXAMPLE_CARDS.length)
    expect(await api.addExampleCards()).toBe(0)
  })

  it('keeps working in memory when storage fails', async () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    const { api } = setup({ storage: failing })
    const card = await makeCard(api)
    expect(await api.getCard(card.id)).toEqual(card)
  })

  it('starts again from the seed when the stored data is unreadable', async () => {
    const storage = memoryStorage({ [DEMO_STORAGE_KEY]: '{not json' })
    const { api } = setup({ storage })
    expect(await api.listCards()).toEqual([])
    expect((await api.getProfile()).desired_retention).toBe(0.9)
  })

  it('can be reset', async () => {
    const { api } = setup()
    await makeCard(api)
    await api.reset()
    expect(await api.listCards()).toEqual([])
  })
})

describe('profile', () => {
  it('updates the name and retention within the database limits', async () => {
    const { api } = setup()
    const profile = await api.updateProfile({ display_name: '  Sam ', desired_retention: 0.854 })
    expect(profile).toMatchObject({ display_name: 'Sam', desired_retention: 0.85 })
    await expect(api.updateProfile({ desired_retention: 0.99 })).rejects.toMatchObject({ code: '23514' })
    expect((await api.getProfile()).desired_retention).toBe(0.85)
  })
})

describe('topics', () => {
  it('adds topics at the end of their subject', async () => {
    const { api } = setup()
    const before = (await api.listTopics()).filter((t) => t.subject === 'physics')
    const topic = await api.createTopic({ subject: 'physics', name: '  Test topic Alpha ', unit: ' ' })
    expect(topic).toMatchObject({ name: 'Test topic Alpha', unit: null, position: before.length })
  })

  it('rejects a duplicate name in the same subject, ignoring case and spaces', async () => {
    const { api } = setup()
    await api.createTopic({ subject: 'physics', name: 'Test topic Alpha' })
    const error = await api.createTopic({ subject: 'physics', name: 'test TOPIC alpha ' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: '23505' })
    expect(friendlyError(error)).toBe('You already have a topic with that name in this subject.')
    await expect(api.createTopic({ subject: 'maths', name: 'Test topic Alpha' })).resolves.toBeTruthy()
  })

  it('detaches cards from a deleted topic', async () => {
    const { api } = setup()
    const topic = await api.createTopic({ subject: 'physics', name: 'Test topic Alpha' })
    const card = await makeCard(api, { topic_id: topic.id })
    await api.deleteTopic(topic.id)
    expect((await api.getCard(card.id))?.topic_id).toBeNull()
    expect((await api.listTopics()).some((t) => t.id === topic.id)).toBe(false)
  })

  it('reorders a subject', async () => {
    const { api } = setup({ exampleCards: false })
    const a = await api.createTopic({ subject: 'physics', name: 'Test A' })
    const b = await api.createTopic({ subject: 'physics', name: 'Test B' })
    const physics = (await api.listTopics()).filter((t) => t.subject === 'physics')
    const order = [b.id, a.id, ...physics.map((t) => t.id).filter((id) => id !== a.id && id !== b.id)]
    await api.reorderTopics('physics', order)
    const reordered = (await api.listTopics()).filter((t) => t.subject === 'physics')
    expect(reordered.map((t) => t.id)).toEqual(order)
  })
})

describe('cards', () => {
  it('creates a new, due card with trimmed text', async () => {
    const { api } = setup()
    const card = await makeCard(api, { question: '  Define power. ' })
    expect(card).toMatchObject({
      question: 'Define power.',
      origin: 'manual',
      category: 'new',
      fsrs_state: 0,
      due: START.toISOString(),
      last_score: null,
      suspended: false,
    })
  })

  it('enforces the database constraints', async () => {
    const { api } = setup()
    await expect(makeCard(api, { key_points: [] })).rejects.toMatchObject({ code: '23514' })
    await expect(makeCard(api, { question: '   ' })).rejects.toMatchObject({ code: '23514' })
    const duplicateIds = [KEY_POINTS[0]!, { ...KEY_POINTS[1]!, id: KEY_POINTS[0]!.id }]
    await expect(makeCard(api, { key_points: duplicateIds })).rejects.toMatchObject({ code: '23514' })
    const mathsTopic = await api.createTopic({ subject: 'maths', name: 'Test topic Alpha' })
    await expect(makeCard(api, { topic_id: mathsTopic.id })).rejects.toMatchObject({ code: '23503' })
  })

  it('lists due cards soonest first, skipping suspended ones', async () => {
    const { api } = setup()
    const first = await makeCard(api)
    clock = later(1)
    const second = await makeCard(api, { subject: 'maths' })
    clock = later(2)
    const suspended = await makeCard(api)
    await api.updateCard(suspended.id, { suspended: true })
    clock = later(3)
    const notYet = await makeCard(api)
    await review(api, notYet, [true, true, true], { at: later(3) })

    const due = await api.listDueCards({ now: later(4) })
    expect(due.map((c) => c.id)).toEqual([first.id, second.id])
    expect((await api.listDueCards({ now: later(4), subject: 'maths' })).map((c) => c.id)).toEqual([second.id])
    expect(await api.listDueCards({ now: later(4), limit: 1 })).toHaveLength(1)
    expect((await api.listCards()).map((c) => c.id)).toEqual([notYet.id, suspended.id, second.id, first.id])

    const summary = await api.dueSummary(later(4))
    expect(summary).toMatchObject({ dueNow: 2, total: 4 })
    expect(summary.bySubject).toMatchObject({ maths: 1, physics: 1 })
    expect(summary.byCategory).toMatchObject({ new: 2, learning: 1 })
  })

  it('deletes a card with its reviews, keeping the mistake log text', async () => {
    const { api, state } = setup()
    const card = await makeCard(api)
    await review(api, card, [true, false, false])
    await api.deleteCard(card.id)
    expect(await api.getCard(card.id)).toBeNull()
    expect(state().reviews).toHaveLength(0)
    expect(state().mistakes).toHaveLength(2)
    expect(state().mistakes.every((m) => m.card_id === null && m.review_id === null)).toBe(true)
  })
})

describe('recordReview', () => {
  it('rejects a rating that does not match the score, saving nothing', async () => {
    const { api, state } = setup()
    const card = await makeCard(api)
    const results = resultsFor(card, [true, false, false])
    const card_after = scheduleNext(snapshotFromRow(card), 3, START)
    const attempt = (rating: 1 | 2 | 3 | 4, easy = false) =>
      api.recordReview({ card_id: card.id, results, card_after, rating, easy })

    await expect(attempt(3)).rejects.toMatchObject({ code: '22023' })
    await expect(attempt(1)).rejects.toMatchObject({ code: '22023' })
    // "Easy" only counts with full marks.
    await expect(attempt(4, true)).rejects.toMatchObject({ code: '22023' })
    const allHit = resultsFor(card, [true, true, true])
    await expect(
      api.recordReview({ card_id: card.id, results: allHit, card_after, rating: 3, easy: true }),
    ).rejects.toMatchObject({ code: '22023' })
    await expect(
      api.recordReview({ card_id: card.id, results: [], card_after, rating: 1 }),
    ).rejects.toMatchObject({ code: '22023' })

    expect(state().reviews).toHaveLength(0)
    expect(await api.getCard(card.id)).toEqual(card)
  })

  it('saves the review, the schedule and the score', async () => {
    const { api } = setup()
    const card = await makeCard(api)
    clock = later(5)
    const after = scheduleNext(snapshotFromRow(card), 2, later(5))
    const { review: saved, card: updated } = await review(api, card, [true, true, false], {
      at: later(5),
      input: { duration_ms: 4200, grading: 'self' },
    })

    expect(saved).toMatchObject({
      card_id: card.id,
      answer: 'My answer',
      grading: 'self',
      points_hit: 2,
      points_total: 3,
      easy: false,
      rating: 2,
      duration_ms: 4200,
      amended_at: null,
      reviewed_at: later(5).toISOString(),
      corrections: [],
      missing: [],
    })
    expect(saved.card_before).toEqual(snapshotFromRow(card))
    expect(snapshotFromRow(updated)).toEqual(after)
    expect(updated.last_score).toBeCloseTo(2 / 3)
    expect(updated.category).toBe('learning')
    expect(await api.listReviewsForCard(card.id)).toEqual([saved])
  })

  it('requires exactly one result per key point', async () => {
    const { api, state } = setup()
    const card = await makeCard(api)
    const [one, two, three] = resultsFor(card, [true, true, true])
    const attempt = (results: PointResult[]) =>
      api.recordReview({
        card_id: card.id,
        results,
        card_after: scheduleNext(snapshotFromRow(card), 3, START),
        rating: 3,
      })

    for (const results of [
      [one!, two!],
      [one!, two!, two!],
      [one!, two!, three!, { ...three!, key_point_id: 'kp_unknown' }],
      [one!, two!, { ...three!, key_point_id: 'kp_unknown' }],
    ]) {
      const error = await attempt(results).catch((e: unknown) => e)
      expect(error).toMatchObject({ code: CARD_CONFLICT_CODE })
      expect(friendlyError(error)).toBe('This card was just changed on another device. Please try again.')
    }
    // Any order is fine.
    await expect(attempt([three!, one!, two!])).resolves.toBeTruthy()
    expect(state().reviews).toHaveLength(1)
  })

  it('logs one mistake per missed point, with the SQL wording rules', async () => {
    const { api, state } = setup({ exampleCards: false })
    const topic = await api.createTopic({ subject: 'physics', name: 'Test topic Alpha' })
    const card = await makeCard(api, { topic_id: topic.id })
    const { review: saved } = await review(api, card, [false, false, true], {
      extra: [
        { reason: '  Said energy is "used up"  ', quote: 'energy gets used up' },
        // The card's wording wins over the wording copied into the result.
        { quote: '   ', reason: '  ', point: 'Stale wording' },
      ],
    })
    const mistakes = state().mistakes.filter((m) => m.review_id === saved.id)
    expect(
      mistakes.map((m) => [m.key_point_id, m.what_went_wrong, m.fix, m.mistake_type]),
    ).toEqual([
      ['kp_one', 'Said energy is "used up"', 'Energy cannot be created or destroyed', 'wording'],
      ['kp_two', 'Missed: It can only be transferred between stores', 'It can only be transferred between stores', 'knowledge'],
    ])
    for (const mistake of mistakes) {
      expect(mistake).toMatchObject({
        origin: 'review',
        source: 'Flashcard review',
        subject: 'physics',
        card_id: card.id,
        topic_id: topic.id,
        raw_text: null,
        flashcard_id: null,
        created_at: START.toISOString(),
      })
    }
  })

  it('overrides against the reviewed points, even after the card is edited', async () => {
    const { api, state } = setup()
    const card = await makeCard(api)
    const first = await review(api, card, [false, false, false])
    const edited = await api.updateCard(card.id, {
      key_points: [{ ...KEY_POINTS[0]!, point: 'Energy is conserved' }, { id: 'kp_four', point: 'A new point', accept: [], reject: [] }],
    })

    // A new review must mark the card's current points...
    await expect(review(api, first.card, [true, true, true])).rejects.toMatchObject({ code: CARD_CONFLICT_CODE })
    // ...an override, the points that were reviewed.
    await expect(
      review(api, edited, [true, true], { input: { review_id: first.review.id } }),
    ).rejects.toMatchObject({ code: '22023' })

    const results = resultsFor(card, [true, false, false], [{}, {}, { point: '' }])
    await api.recordReview({
      card_id: card.id,
      review_id: first.review.id,
      results,
      rating: 2,
      card_after: scheduleNext(first.review.card_before, 2, new Date(first.review.reviewed_at)),
    })
    // Points no longer on the card fall back to the result's wording, then to generic copy.
    expect(state().mistakes.map((m) => [m.key_point_id, m.what_went_wrong, m.fix])).toEqual([
      ['kp_two', 'Missed: It can only be transferred between stores', 'It can only be transferred between stores'],
      ['kp_three', 'Missed: a key point', 'See the mark scheme for this card.'],
    ])
  })

  it('amends only the latest review and rebuilds its mistakes', async () => {
    const { api, state } = setup()
    const card = await makeCard(api)
    const first = await review(api, card, [false, false, false], { at: later(1) })
    const second = await review(api, first.card, [true, false, false], {
      at: later(20),
      input: { corrections: [{ exact_substring: 'used up', correction: 'transferred' }], missing: ['stores'] },
    })

    const stale = await review(api, card, [true, true, true], {
      at: later(1),
      input: { review_id: first.review.id },
    }).catch((e: unknown) => e)
    expect(stale).toMatchObject({ code: '55000' })
    expect(friendlyError(stale)).toBe('Only your most recent answer to a card can be changed.')

    // Override: reschedule from the review's card_before at its reviewed_at.
    clock = later(25)
    const results = resultsFor(card, [true, true, false]).map((r, i) => ({ ...r, overridden: i === 1 }))
    const amended = await api.recordReview({
      card_id: card.id,
      review_id: second.review.id,
      results,
      rating: 2,
      card_after: scheduleNext(second.review.card_before, 2, new Date(second.review.reviewed_at)),
    })

    expect(amended.review).toMatchObject({
      id: second.review.id,
      points_hit: 2,
      rating: 2,
      reviewed_at: second.review.reviewed_at,
      amended_at: later(25).toISOString(),
      answer: 'My answer',
      corrections: [{ exact_substring: 'used up', correction: 'transferred' }],
      missing: ['stores'],
    })
    expect(amended.review.card_before).toEqual(second.review.card_before)
    expect(state().reviews).toHaveLength(2)
    expect(
      state()
        .mistakes.filter((m) => m.review_id === second.review.id)
        .map((m) => m.key_point_id),
    ).toEqual(['kp_three'])
    expect(state().mistakes.filter((m) => m.review_id === first.review.id)).toHaveLength(3)
    expect(amended.card.last_score).toBeCloseTo(2 / 3)
  })

  it('updates the category from the review history', async () => {
    const { api } = setup()
    let card = await makeCard(api)

    card = (await review(api, card, [false, false, false], { at: later(1) })).card
    expect(card.category).toBe('weak')
    card = (await review(api, card, [true, true, false], { at: later(2) })).card
    expect(card.category).toBe('learning')
    card = (await review(api, card, [false, false, false], { at: later(3) })).card
    expect(card.category).toBe('weak')

    const longInterval = { scheduled_days: 30 }
    card = (await review(api, card, [true, true, true], { at: later(4), after: longInterval })).card
    card = (await review(api, card, [true, true, true], { at: later(5), after: longInterval })).card
    expect(card.category).toBe('weak')
    card = (await review(api, card, [true, true, true], { at: later(6), easy: true, after: longInterval })).card
    expect(card.category).toBe('mastered')
    // Not over 21 days, and only one Again is left in the last five reviews.
    card = (await review(api, card, [true, true, true], { at: later(7), after: { scheduled_days: 21 } })).card
    expect(card.category).toBe('learning')
  })

  it('reports a missing card or review', async () => {
    const { api } = setup()
    const card = await makeCard(api)
    await expect(review(api, { ...card, id: 'missing' }, [true, true, true])).rejects.toMatchObject({
      code: 'P0002',
    })
    await expect(
      review(api, card, [true, true, true], { input: { review_id: 'missing' } }),
    ).rejects.toMatchObject({ code: 'P0002', message: 'Review not found' })
  })

  it('returns the saved review for a repeated id, changing nothing', async () => {
    const { api, state } = setup()
    const card = await makeCard(api)
    const id = '00000000-0000-4000-8000-00000000cafe'
    const first = await review(api, card, [true, false, false], { input: { id, expected_reps: 0 } })
    expect(first.review.id).toBe(id)
    const before = state()

    await api.updateCard(card.id, { key_points: [KEY_POINTS[0]!] })
    const edited = state()
    const replay = await review(api, card, [true, true, true], { input: { id, expected_reps: 0 } })

    expect(replay.review).toEqual(first.review)
    expect(replay.card.key_points).toEqual([KEY_POINTS[0]])
    expect(state().reviews).toEqual(before.reviews)
    expect(state().mistakes).toEqual(before.mistakes)
    expect(state().cards).toEqual(edited.cards)
  })

  it('rejects a stale schedule, writing nothing', async () => {
    const { api, state } = setup()
    const card = await makeCard(api)
    const { card: moved } = await review(api, card, [true, true, true], { input: { expected_reps: 0 } })
    const before = state()

    const error = await review(api, card, [true, false, false], { input: { expected_reps: 0 } }).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: CARD_CONFLICT_CODE })
    expect(friendlyError(error)).toBe('This card was just changed on another device. Please try again.')
    expect(state()).toEqual(before)
    // Without the count, nothing is compared.
    await expect(review(api, moved, [true, false, false])).resolves.toBeTruthy()
  })

  it('rejects scheduling state that Postgres could not store, saving nothing', async () => {
    const { api, state } = setup()
    const card = await makeCard(api)
    await expect(review(api, card, [true, true, true], { after: { reps: 1.5 } })).rejects.toMatchObject({
      code: '22P02',
    })
    await expect(
      review(api, card, [true, true, true], { after: { due: undefined } as Partial<FsrsSnapshot> }),
    ).rejects.toMatchObject({ code: '22023' })
    expect(state().reviews).toHaveLength(0)
    expect(state().mistakes).toHaveLength(0)
  })
})
