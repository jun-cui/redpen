// The card editor's form: its shape, limits, validation and conversion to a CardDraft.

import type { CardDraft } from '../../data/api'
import type { CardRow } from '../../lib/database.types'
import { newKeyPointId } from '../../lib/ids'
import type { KeyPoint, SubjectCode } from '../../lib/types'

/** Database limits (supabase/migrations: cards.question, key_points_valid). */
export const LIMITS = {
  question: 4000,
  point: 500,
  tag: 300,
  points: 20,
} as const

/** Show a character count once text is this close to its limit. */
export const COUNTER_FROM = { question: 3600, point: 420 } as const

/** Router state passed when opening the editor from the library, so it can go back there. */
export interface EditorLocationState {
  returnTo?: string
}

export function readReturnTo(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const value = (state as EditorLocationState).returnTo
  return typeof value === 'string' && value.startsWith('/cards') ? value : null
}

export interface CardForm {
  subject: SubjectCode
  topicId: string | null
  question: string
  points: KeyPoint[]
}

export function blankPoint(): KeyPoint {
  return { id: newKeyPointId(), point: '', accept: [], reject: [] }
}

export function blankForm(subject: SubjectCode, topicId: string | null = null): CardForm {
  return { subject, topicId, question: '', points: [blankPoint()] }
}

/** The form for an existing card. Key point ids are kept: reviews refer to them. */
export function formFromCard(card: CardRow): CardForm {
  return {
    subject: card.subject,
    topicId: card.topic_id,
    question: card.question,
    points: card.key_points.map((kp) => ({ id: kp.id, point: kp.point, accept: [...kp.accept], reject: [...kp.reject] })),
  }
}

function contentKey(form: CardForm): string {
  return JSON.stringify([form.question, form.points])
}

/**
 * Whether leaving would lose work. For a new card only the writing counts (choosing a subject
 * and topic isn't worth a warning); for an existing card, any change does.
 */
export function isDirty(form: CardForm, baseline: CardForm, isNew: boolean): boolean {
  if (contentKey(form) !== contentKey(baseline)) return true
  return !isNew && (form.subject !== baseline.subject || form.topicId !== baseline.topicId)
}

export type FieldKey = 'topic' | 'question' | 'points' | `point:${string}`

export type FormErrors = Partial<Record<FieldKey, string>>

export interface ValidateOptions {
  /** True when the subject has topics, so one must be chosen. */
  topicRequired: boolean
  /** Ids of topics the card may use (the subject's topics, including its current archived one). */
  validTopicIds: ReadonlySet<string>
}

const chars = (text: string) => [...text].length

export function validateForm(form: CardForm, { topicRequired, validTopicIds }: ValidateOptions): FormErrors {
  const errors: FormErrors = {}
  if (topicRequired && (!form.topicId || !validTopicIds.has(form.topicId))) errors.topic = 'Choose a topic.'

  const question = form.question.trim()
  if (!question) errors.question = 'Write the question.'
  else if (chars(question) > LIMITS.question) {
    errors.question = `Keep the question to ${LIMITS.question.toLocaleString('en-GB')} characters or fewer.`
  }

  if (form.points.length === 0) errors.points = 'Add at least one key point.'
  else if (form.points.length > LIMITS.points) errors.points = `A card can have up to ${LIMITS.points} key points.`

  for (const kp of form.points) {
    const text = kp.point.trim()
    if (!text) errors[`point:${kp.id}`] = 'Write this point, or remove it.'
    else if (chars(text) > LIMITS.point) {
      errors[`point:${kp.id}`] = `Keep each point to ${LIMITS.point} characters or fewer.`
    }
  }
  return errors
}

/** Error keys in the order the fields appear, so the first can take focus. */
export function errorOrder(form: CardForm): FieldKey[] {
  return ['topic', 'question', 'points', ...form.points.map((kp) => `point:${kp.id}` as const)]
}

/** The form as the data layer wants it (it trims and removes empty tags too). */
export function toDraft(form: CardForm): CardDraft {
  return {
    subject: form.subject,
    topic_id: form.topicId,
    question: form.question.trim(),
    key_points: form.points.map((kp) => ({
      id: kp.id,
      point: kp.point.trim(),
      accept: kp.accept.map((tag) => tag.trim()).filter(Boolean),
      reject: kp.reject.map((tag) => tag.trim()).filter(Boolean),
    })),
  }
}
