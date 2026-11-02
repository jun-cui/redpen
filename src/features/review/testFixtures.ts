// Test data for the review feature's unit tests. Not used by the app.

import type { CardRow, ReviewRow } from '../../lib/database.types'
import type { KeyPoint, PointResult } from '../../lib/types'

export const KEY_POINTS: KeyPoint[] = [
  { id: 'kp_a', point: 'Weight acts down, drag and upthrust act up', accept: ['viscous force'], reject: ['friction'] },
  { id: 'kp_b', point: 'Drag increases with speed', accept: [], reject: [] },
  { id: 'kp_c', point: 'Resultant force becomes zero', accept: ['forces balance'], reject: [] },
]

export function cardRow(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: 'card-1',
    user_id: 'user-1',
    subject: 'physics',
    topic_id: null,
    question: 'Explain why a ball falling through oil reaches a terminal velocity.',
    key_points: KEY_POINTS,
    origin: 'manual',
    suspended: false,
    fsrs_state: 0,
    due: '2026-10-23T09:00:00.000Z',
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
    created_at: '2026-10-20T09:00:00.000Z',
    updated_at: '2026-10-20T09:00:00.000Z',
    ...overrides,
  }
}

export function result(id: string, hit: boolean, overrides: Partial<PointResult> = {}): PointResult {
  return { key_point_id: id, point: `Point ${id}`, quote: null, reason: null, hit, ai_hit: null, overridden: false, ...overrides }
}

export function reviewRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  const results = overrides.results ?? [result('kp_a', true), result('kp_b', false)]
  const hit = results.filter((r) => r.hit).length
  return {
    id: 'review-1',
    user_id: 'user-1',
    card_id: 'card-1',
    reviewed_at: '2026-10-23T10:00:00.000Z',
    answer: 'An answer',
    grading: 'self',
    results,
    corrections: [],
    missing: [],
    points_hit: hit,
    points_total: results.length,
    easy: false,
    rating: hit === 0 ? 1 : hit < results.length ? 2 : 3,
    card_before: {
      state: 0,
      due: '2026-10-23T09:00:00.000Z',
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      last_review: null,
    },
    duration_ms: 30_000,
    amended_at: null,
    ...overrides,
  }
}
