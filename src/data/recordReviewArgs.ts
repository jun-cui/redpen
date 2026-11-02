import type { Database } from '../lib/database.types'
import type { RecordReviewInput } from './api'

export type RecordReviewArgs = Database['public']['Functions']['record_review']['Args']

/** The named arguments of the record_review RPC for an Api.recordReview() call. */
export function recordReviewArgs(input: RecordReviewInput): RecordReviewArgs {
  const amending = input.review_id !== undefined
  const args: RecordReviewArgs = {
    p_card_id: input.card_id,
    p_results: input.results,
    p_card_after: input.card_after,
    p_rating: input.rating,
    p_easy: input.easy ?? false,
    p_answer: input.answer ?? '',
    p_grading: input.grading ?? 'self',
    // null tells the RPC to keep the review's existing value when amending.
    p_corrections: input.corrections ?? (amending ? null : []),
    p_missing: input.missing ?? (amending ? null : []),
  }
  if (input.reviewed_at !== undefined) args.p_reviewed_at = input.reviewed_at
  if (input.duration_ms != null) args.p_duration_ms = Math.max(0, Math.round(input.duration_ms))
  if (input.review_id !== undefined) args.p_review_id = input.review_id
  if (input.id !== undefined) args.p_id = input.id
  if (input.expected_reps !== undefined) args.p_expected_reps = input.expected_reps
  return args
}
