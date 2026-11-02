// Domain types shared across the app. The database stores these shapes in jsonb columns
// (see supabase/migrations and src/lib/database.types.ts).

export type SubjectCode = 'maths' | 'further_maths' | 'physics' | 'computer_science'

export type CardCategory = 'new' | 'learning' | 'weak' | 'mastered'

export type CardOrigin = 'manual' | 'generated' | 'mistake' | 'example'

/** How an answer was marked: by the student, by the AI, or by the student after the AI failed. */
export type Grading = 'self' | 'ai' | 'ai_fallback'

export type MistakeType = 'slip' | 'method' | 'knowledge' | 'wording'

export type MistakeOrigin = 'review' | 'manual'

/** One mark-scheme point on a card. `id` is unique within the card. */
export interface KeyPoint {
  id: string
  point: string
  /** Alternative wordings that also earn the point ("accept", "allow"). */
  accept: string[]
  /** Answers that must not earn the point ("do not accept", "ignore" when it would mislead). */
  reject: string[]
}

/** The marking outcome for one key point, in the order the AI is asked to produce it. */
export interface PointResult {
  key_point_id: string
  point: string
  /** The relevant part of the student's answer, verbatim, or null if nothing relevant. */
  quote: string | null
  reason: string | null
  hit: boolean
  /** What the AI originally decided; null when self-graded. */
  ai_hit: boolean | null
  /** True when the student changed the AI's decision. */
  overridden: boolean
}

/** A suggested rewrite of a verbatim part of the student's answer. */
export interface Correction {
  exact_substring: string
  correction: string
}

/** FSRS state as stored in the database (mirrors ts-fsrs Card, dates as ISO strings). */
export interface FsrsSnapshot {
  state: 0 | 1 | 2 | 3
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  last_review: string | null
}
