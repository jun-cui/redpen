// Input clean-up shared by the Api implementations, so both store exactly the same values.

import type { CardRow, ProfileRow, TopicRow } from '../lib/database.types'
import type { KeyPoint } from '../lib/types'
import type { CardDraft, CardPatch, NewTopic, ProfilePatch, TopicPatch } from './api'

function cleanList(items: readonly string[] | undefined): string[] {
  const seen = new Set<string>()
  for (const item of items ?? []) {
    const value = item.trim()
    if (value) seen.add(value)
  }
  return [...seen]
}

/** Trims every string and drops key points left without any wording. */
export function normalizeKeyPoints(points: readonly KeyPoint[]): KeyPoint[] {
  return points
    .map((kp) => ({
      id: kp.id,
      point: kp.point.trim(),
      accept: cleanList(kp.accept),
      reject: cleanList(kp.reject),
    }))
    .filter((kp) => kp.point.length > 0)
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

type CardInsert = Pick<CardRow, 'subject' | 'topic_id' | 'question' | 'key_points' | 'origin'>

export function normalizeCardDraft(draft: CardDraft): CardInsert {
  return {
    subject: draft.subject,
    topic_id: draft.topic_id,
    question: draft.question.trim(),
    key_points: normalizeKeyPoints(draft.key_points),
    origin: draft.origin ?? 'manual',
  }
}

export function normalizeCardPatch(patch: CardPatch): Partial<CardInsert & Pick<CardRow, 'suspended'>> {
  const update: Partial<CardInsert & Pick<CardRow, 'suspended'>> = {}
  if (patch.subject !== undefined) update.subject = patch.subject
  if (patch.topic_id !== undefined) update.topic_id = patch.topic_id
  if (patch.question !== undefined) update.question = patch.question.trim()
  if (patch.key_points !== undefined) update.key_points = normalizeKeyPoints(patch.key_points)
  if (patch.origin !== undefined) update.origin = patch.origin
  if (patch.suspended !== undefined) update.suspended = patch.suspended
  return update
}

export function normalizeNewTopic(topic: NewTopic): Pick<TopicRow, 'subject' | 'name' | 'unit'> {
  return { subject: topic.subject, name: topic.name.trim(), unit: optionalText(topic.unit) }
}

export function normalizeTopicPatch(patch: TopicPatch): Partial<Pick<TopicRow, 'name' | 'unit' | 'archived'>> {
  const update: Partial<Pick<TopicRow, 'name' | 'unit' | 'archived'>> = {}
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.unit !== undefined) update.unit = optionalText(patch.unit)
  if (patch.archived !== undefined) update.archived = patch.archived
  return update
}

/**
 * The position changes that put a subject's topics in `orderedIds` order. Topics missing from
 * `orderedIds` (for example archived ones the list didn't show) keep their relative order after
 * the listed ones. Only topics whose position actually changes are returned.
 */
export function topicPositionUpdates(
  current: readonly Pick<TopicRow, 'id' | 'position' | 'name'>[],
  orderedIds: readonly string[],
): { id: string; position: number }[] {
  const byId = new Map(current.map((topic) => [topic.id, topic]))
  const listed = [...new Set(orderedIds)].filter((id) => byId.has(id))
  const listedSet = new Set(listed)
  const unlisted = current
    .filter((topic) => !listedSet.has(topic.id))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((topic) => topic.id)

  return [...listed, ...unlisted].flatMap((id, position) =>
    byId.get(id)?.position === position ? [] : [{ id, position }],
  )
}

export function normalizeProfilePatch(
  patch: ProfilePatch,
): Partial<Pick<ProfileRow, 'display_name' | 'desired_retention'>> {
  const update: Partial<Pick<ProfileRow, 'display_name' | 'desired_retention'>> = {}
  if (patch.display_name !== undefined) update.display_name = optionalText(patch.display_name)
  if (patch.desired_retention !== undefined) {
    // numeric(3, 2) in the database
    update.desired_retention = Math.round(patch.desired_retention * 100) / 100
  }
  return update
}
