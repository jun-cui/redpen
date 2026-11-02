// What the app needs from a backend. Implemented by supabaseApi (production) and, during
// local development without a Supabase project, by the in-browser demo in ./demo.
// Methods reject with the backend's own error objects; show them with friendlyError().

import type { CardRow, ProfileRow, ReviewRow, TopicRow } from '../lib/database.types'
import type { RatingValue } from '../lib/fsrs'
import type {
  CardCategory,
  CardOrigin,
  Correction,
  FsrsSnapshot,
  Grading,
  KeyPoint,
  PointResult,
  SubjectCode,
} from '../lib/types'

export interface ProfilePatch {
  /** Empty or blank clears the name. */
  display_name?: string | null
  /** Between 0.70 and 0.97; stored to two decimal places. */
  desired_retention?: number
}

export interface NewTopic {
  subject: SubjectCode
  name: string
  unit?: string | null
}

export interface TopicPatch {
  name?: string
  unit?: string | null
  archived?: boolean
}

export interface CardDraft {
  subject: SubjectCode
  topic_id: string | null
  question: string
  key_points: KeyPoint[]
  /** Defaults to 'manual'. */
  origin?: CardOrigin
}

export type CardPatch = Partial<CardDraft> & { suspended?: boolean }

export interface DueCardsQuery {
  now: Date
  subject?: SubjectCode
  limit?: number
}

export interface DueSummary {
  /** Cards due now (not suspended). */
  dueNow: number
  /** Cards that become due later today, local time (not suspended). */
  dueLaterToday: number
  /** All of the user's cards, including suspended ones. */
  total: number
  /** Cards due now, per subject. */
  bySubject: Record<SubjectCode, number>
  /** Cards that aren't suspended, per category. */
  byCategory: Record<CardCategory, number>
  /** When the next card that isn't due yet becomes due (ISO), or null if there is none. */
  nextDueAt: string | null
}

/** Arguments of the record_review RPC, without the p_ prefix. */
export interface RecordReviewInput {
  card_id: string
  /** One per key point, in the card's order. The score is counted from `hit`. */
  results: PointResult[]
  /** FSRS state after this review, from scheduleNext(). */
  card_after: FsrsSnapshot
  /** Must match the score: 0 points = 1, some = 2, all = 3, all + easy = 4. */
  rating: RatingValue
  easy?: boolean
  answer?: string
  grading?: Grading
  /** Omitted: [] for a new review; kept as they are when amending. */
  corrections?: Correction[]
  /** Omitted: [] for a new review; kept as they are when amending. */
  missing?: string[]
  /** ISO timestamp; defaults to now. Ignored when amending. */
  reviewed_at?: string
  duration_ms?: number | null
  /** Amend this review (an override) instead of adding one. Must be the card's latest review. */
  review_id?: string
  /**
   * The new review's id, chosen when the answer is handed in. Sent again (a retry after a lost
   * response), the saved review comes back and nothing changes. Ignored when amending.
   */
  id?: string
  /**
   * The card's reps when `card_after` was computed. If the card has moved on, the call rejects
   * with CARD_CONFLICT_CODE and nothing is written. Ignored when amending.
   */
  expected_reps?: number
}

export interface RecordReviewResult {
  review: ReviewRow
  card: CardRow
}

export interface Api {
  // Profile
  getProfile(): Promise<ProfileRow>
  updateProfile(patch: ProfilePatch): Promise<ProfileRow>

  // Topics: every subject, ordered by subject, position, name. Includes archived topics.
  listTopics(): Promise<TopicRow[]>
  createTopic(topic: NewTopic): Promise<TopicRow>
  updateTopic(id: string, patch: TopicPatch): Promise<TopicRow>
  /** Cards and mistakes in the topic keep existing, without a topic. */
  deleteTopic(id: string): Promise<void>
  /** Sets each topic's position to its index in `orderedIds`. */
  reorderTopics(subject: SubjectCode, orderedIds: readonly string[]): Promise<void>

  // Cards
  /** All of the user's cards (including suspended), newest first. */
  listCards(): Promise<CardRow[]>
  /** null when the card doesn't exist (or isn't the user's). */
  getCard(id: string): Promise<CardRow | null>
  createCard(draft: CardDraft): Promise<CardRow>
  updateCard(id: string, patch: CardPatch): Promise<CardRow>
  deleteCard(id: string): Promise<void>
  /** Cards due at or before `now`, not suspended, soonest first. */
  listDueCards(query: DueCardsQuery): Promise<CardRow[]>
  dueSummary(now: Date): Promise<DueSummary>
  /**
   * Adds the example cards, once: nothing is added if the user already has any example card.
   * Resolves to how many cards were added.
   */
  addExampleCards(): Promise<number>

  // Reviews
  recordReview(input: RecordReviewInput): Promise<RecordReviewResult>
  /** The card's reviews, newest first. */
  listReviewsForCard(cardId: string, limit?: number): Promise<ReviewRow[]>
}

export const DEFAULT_REVIEWS_LIMIT = 20
