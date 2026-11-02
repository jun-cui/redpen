import type { PointResult } from './types'

export interface Score {
  hit: number
  total: number
  /** hit / total, from 0 to 1 (0 when there are no points). */
  fraction: number
}

/** The mark for an answer, counted from the per-point results (as record_review does). */
export function scoreOf(results: readonly Pick<PointResult, 'hit'>[]): Score {
  const total = results.length
  const hit = results.reduce((count, result) => count + (result.hit ? 1 : 0), 0)
  return { hit, total, fraction: total > 0 ? hit / total : 0 }
}

export function isFullMarks(score: Score): boolean {
  return score.total > 0 && score.hit === score.total
}
