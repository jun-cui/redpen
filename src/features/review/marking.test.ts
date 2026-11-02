import { describe, expect, it } from 'vitest'
import { newCardSnapshot, previewNextDue, scheduleNext, snapshotFromRow } from '../../lib/fsrs'
import {
  blankResults,
  buildOverrideInput,
  buildReviewInput,
  changedPointCount,
  effectiveEasy,
  MAX_ANSWER_LENGTH,
  marksKeyPoints,
  nextDueFor,
  overrideResults,
  ratingFor,
  rebuildMarking,
  rescheduleTime,
  selfMarking,
  setPoint,
  togglePoint,
} from './marking'
import { cardRow, KEY_POINTS, result, reviewRow } from './testFixtures'

const NOW = new Date('2026-10-23T10:00:00.000Z')
const REVIEW_ID = '00000000-0000-4000-8000-00000000cafe'

describe('blankResults / selfMarking', () => {
  it('starts every key point unticked, in the card order, with the point text', () => {
    expect(blankResults(KEY_POINTS)).toEqual([
      { key_point_id: 'kp_a', point: KEY_POINTS[0]?.point, quote: null, reason: null, hit: false, ai_hit: null, overridden: false },
      { key_point_id: 'kp_b', point: KEY_POINTS[1]?.point, quote: null, reason: null, hit: false, ai_hit: null, overridden: false },
      { key_point_id: 'kp_c', point: KEY_POINTS[2]?.point, quote: null, reason: null, hit: false, ai_hit: null, overridden: false },
    ])
  })

  it('has no corrections or missing points', () => {
    expect(selfMarking(KEY_POINTS)).toMatchObject({ corrections: [], missing: [] })
  })
})

describe('marksKeyPoints', () => {
  const results = blankResults(KEY_POINTS)

  it('accepts the same points, in any order', () => {
    expect(marksKeyPoints(results, KEY_POINTS)).toBe(true)
    expect(marksKeyPoints([...results].reverse(), KEY_POINTS)).toBe(true)
  })

  it('notices a point added, removed or swapped', () => {
    const added = { id: 'kp_d', point: 'A new point', accept: [], reject: [] }
    expect(marksKeyPoints(results, [...KEY_POINTS, added])).toBe(false)
    expect(marksKeyPoints(results, KEY_POINTS.slice(1))).toBe(false)
    expect(marksKeyPoints(results, [...KEY_POINTS.slice(1), added])).toBe(false)
  })
})

describe('rebuildMarking', () => {
  const ticked = { ...selfMarking(KEY_POINTS), results: togglePoint(blankResults(KEY_POINTS), 'kp_b') }

  it('keeps ticks for points that still exist, and adds new points unticked', () => {
    const added = { id: 'kp_d', point: 'A new point', accept: [], reject: [] }
    const { results } = rebuildMarking(ticked, [KEY_POINTS[1]!, added])
    expect(results.map((r) => [r.key_point_id, r.hit])).toEqual([
      ['kp_b', true],
      ['kp_d', false],
    ])
    expect(results[1]).toEqual(blankResults([added])[0])
  })

  it('takes the current wording and order', () => {
    const reworded = [{ ...KEY_POINTS[1]!, point: 'Drag grows with speed' }, KEY_POINTS[0]!, KEY_POINTS[2]!]
    const { results } = rebuildMarking(ticked, reworded)
    expect(results.map((r) => r.key_point_id)).toEqual(['kp_b', 'kp_a', 'kp_c'])
    expect(results[0]).toMatchObject({ point: 'Drag grows with speed', hit: true })
  })

  it('keeps everything else the marker said', () => {
    const marking = {
      results: [result('kp_a', true, { quote: 'viscous', reason: 'Named it', ai_hit: true })],
      corrections: [{ exact_substring: 'a', correction: 'b' }],
      missing: ['A point'],
    }
    const rebuilt = rebuildMarking(marking, [KEY_POINTS[0]!])
    expect(rebuilt.results[0]).toMatchObject({ quote: 'viscous', reason: 'Named it', ai_hit: true })
    expect(rebuilt).toMatchObject({ corrections: marking.corrections, missing: marking.missing })
  })
})

describe('rescheduleTime', () => {
  it('is now for a card reviewed earlier, or never', () => {
    expect(rescheduleTime({ last_review: '2026-10-23T09:00:00.000Z' }, NOW)).toEqual(NOW)
    expect(rescheduleTime({ last_review: null }, NOW)).toEqual(NOW)
  })

  it('is never before the latest review, however far this clock is behind', () => {
    expect(rescheduleTime({ last_review: '2026-10-23T10:02:00.000+00:00' }, NOW)).toEqual(new Date('2026-10-23T10:02:00.000Z'))
  })
})

describe('togglePoint / setPoint', () => {
  it('flips one point and leaves the rest', () => {
    const results = togglePoint(blankResults(KEY_POINTS), 'kp_b')
    expect(results.map((r) => r.hit)).toEqual([false, true, false])
    expect(togglePoint(results, 'kp_b').map((r) => r.hit)).toEqual([false, false, false])
  })

  it('never marks a self-graded point as overridden', () => {
    expect(togglePoint(blankResults(KEY_POINTS), 'kp_a')[0]?.overridden).toBe(false)
  })

  it('marks an AI-graded point overridden only while it disagrees with the AI', () => {
    const ai = [result('kp_a', true, { ai_hit: true }), result('kp_b', false, { ai_hit: false })]
    const changed = setPoint(ai, 'kp_a', false)
    expect(changed[0]).toMatchObject({ hit: false, overridden: true })
    expect(setPoint(changed, 'kp_a', true)[0]).toMatchObject({ hit: true, overridden: false })
  })

  it('ignores an unknown key point', () => {
    const results = blankResults(KEY_POINTS)
    expect(togglePoint(results, 'nope')).toEqual(results)
  })
})

describe('ratingFor / effectiveEasy', () => {
  const hits = (...values: boolean[]) => values.map((hit) => ({ hit }))

  it('maps the score to a rating: none Again, some Hard, all Good, all + easy Easy', () => {
    expect(ratingFor(hits(false, false, false), false)).toBe(1)
    expect(ratingFor(hits(true, false, false), false)).toBe(2)
    expect(ratingFor(hits(true, true, false), true)).toBe(2)
    expect(ratingFor(hits(true, true, true), false)).toBe(3)
    expect(ratingFor(hits(true, true, true), true)).toBe(4)
  })

  it('only counts easy with full marks', () => {
    expect(effectiveEasy(hits(true, true), true)).toBe(true)
    expect(effectiveEasy(hits(true, false), true)).toBe(false)
    expect(effectiveEasy(hits(true, true), false)).toBe(false)
    expect(effectiveEasy([], true)).toBe(false)
  })
})

describe('nextDueFor', () => {
  it('previews the due date of the rating the marks earn', () => {
    const before = newCardSnapshot(NOW)
    const preview = previewNextDue(before, NOW, 0.9)
    expect(nextDueFor(before, [{ hit: false }], false, NOW, 0.9)).toEqual(preview[1])
    expect(nextDueFor(before, [{ hit: true }, { hit: false }], false, NOW, 0.9)).toEqual(preview[2])
    expect(nextDueFor(before, [{ hit: true }], false, NOW, 0.9)).toEqual(preview[3])
    expect(nextDueFor(before, [{ hit: true }], true, NOW, 0.9)).toEqual(preview[4])
  })
})

describe('buildReviewInput', () => {
  const card = cardRow()
  const before = snapshotFromRow(card)
  const marking = { ...selfMarking(card.key_points), results: togglePoint(blankResults(card.key_points), 'kp_a') }

  it('builds the record_review call from one moment', () => {
    const input = buildReviewInput({
      id: REVIEW_ID,
      cardId: card.id,
      before,
      marking,
      easy: false,
      answer: '  Weight down, drag up.\n',
      grading: 'self',
      now: NOW,
      retention: 0.9,
      durationMs: 41_234.6,
    })
    expect(input).toEqual({
      id: REVIEW_ID,
      card_id: 'card-1',
      expected_reps: 0,
      results: marking.results,
      card_after: scheduleNext(before, 2, NOW, 0.9),
      rating: 2,
      easy: false,
      answer: 'Weight down, drag up.',
      grading: 'self',
      corrections: [],
      missing: [],
      reviewed_at: '2026-10-23T10:00:00.000Z',
      duration_ms: 41_235,
    })
  })

  it('schedules the same due date the preview showed', () => {
    const input = buildReviewInput({ id: REVIEW_ID, cardId: card.id, before, marking, easy: false, answer: 'x', grading: 'self', now: NOW, retention: 0.9, durationMs: null })
    expect(new Date(input.card_after.due)).toEqual(nextDueFor(before, marking.results, false, NOW, 0.9))
    expect(input.duration_ms).toBeNull()
  })

  it('drops easy without full marks, and keeps it with them', () => {
    const partial = buildReviewInput({ id: REVIEW_ID, cardId: card.id, before, marking, easy: true, answer: '', grading: 'self', now: NOW, retention: 0.9, durationMs: 0 })
    expect(partial).toMatchObject({ rating: 2, easy: false })

    const full = { ...marking, results: marking.results.map((r) => ({ ...r, hit: true })) }
    const easy = buildReviewInput({ id: REVIEW_ID, cardId: card.id, before, marking: full, easy: true, answer: '', grading: 'self', now: NOW, retention: 0.9, durationMs: 0 })
    expect(easy).toMatchObject({ rating: 4, easy: true })
  })

  it('records an empty answer as an empty string', () => {
    const input = buildReviewInput({ id: REVIEW_ID, cardId: card.id, before, marking: selfMarking(card.key_points), easy: false, answer: '', grading: 'self', now: NOW, retention: 0.9, durationMs: 0 })
    expect(input).toMatchObject({ answer: '', rating: 1 })
  })

  it('never sends more than the database accepts', () => {
    const input = buildReviewInput({ id: REVIEW_ID, cardId: card.id, before, marking, easy: false, answer: 'a'.repeat(MAX_ANSWER_LENGTH + 10), grading: 'self', now: NOW, retention: 0.9, durationMs: 0 })
    expect(input.answer).toHaveLength(MAX_ANSWER_LENGTH)
  })

  it('copies the results rather than sharing them', () => {
    const input = buildReviewInput({ id: REVIEW_ID, cardId: card.id, before, marking, easy: false, answer: '', grading: 'self', now: NOW, retention: 0.9, durationMs: 0 })
    expect(input.results[0]).not.toBe(marking.results[0])
  })
})

describe('overrideResults', () => {
  const saved = [result('kp_a', true), result('kp_b', false), result('kp_c', false)]

  it('applies new hits and marks only the changed points as overridden', () => {
    const next = overrideResults(saved, { kp_b: true })
    expect(next.map((r) => [r.hit, r.overridden])).toEqual([
      [true, false],
      [true, true],
      [false, false],
    ])
  })

  it('treats a point changed and changed back as unchanged', () => {
    expect(overrideResults(saved, { kp_a: true }).every((r) => !r.overridden)).toBe(true)
  })

  it('keeps an earlier override', () => {
    const before = [result('kp_a', true, { overridden: true })]
    expect(overrideResults(before, {})[0]?.overridden).toBe(true)
  })

  it('compares AI-graded points with the AI decision', () => {
    const ai = [result('kp_a', false, { ai_hit: true, overridden: true })]
    expect(overrideResults(ai, { kp_a: true })[0]).toMatchObject({ hit: true, overridden: false })
  })

  it('counts the changed points', () => {
    expect(changedPointCount(saved, overrideResults(saved, { kp_b: true, kp_c: true }))).toBe(2)
    expect(changedPointCount(saved, saved)).toBe(0)
  })
})

describe('buildOverrideInput', () => {
  it('reschedules from the state before the review, at the time of the review', () => {
    const review = reviewRow()
    const results = overrideResults(review.results, { kp_b: true })
    const input = buildOverrideInput(review, results, true, 0.9)
    expect(input).toEqual({
      card_id: 'card-1',
      review_id: 'review-1',
      results,
      rating: 4,
      easy: true,
      card_after: scheduleNext(review.card_before, 4, new Date(review.reviewed_at), 0.9),
    })
    // Corrections and missing are left out, so the saved ones are kept.
    expect('corrections' in input).toBe(false)
    expect('missing' in input).toBe(false)
  })

  it('rates the new score', () => {
    const review = reviewRow()
    expect(buildOverrideInput(review, overrideResults(review.results, { kp_a: false }), false, 0.9)).toMatchObject({ rating: 1, easy: false })
  })
})
