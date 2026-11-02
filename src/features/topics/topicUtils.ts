// Topic helpers shared by the topic picker, the topics page and the card library.

import { useMemo } from 'react'
import { useTopics } from '../../data/hooks'
import type { TopicRow } from '../../lib/database.types'
import type { SubjectCode } from '../../lib/types'

/** Database limits (supabase/migrations: topics.name 1-80, topics.unit up to 40). */
export const TOPIC_NAME_MAX = 80
export const TOPIC_UNIT_MAX = 40

/** How the database compares names: case-insensitive, ignoring surrounding spaces. */
export function topicNameKey(name: string): string {
  return name.trim().toLocaleLowerCase('en-GB')
}

/** Display order: position, then name. */
export function byPosition(a: Pick<TopicRow, 'position' | 'name'>, b: Pick<TopicRow, 'position' | 'name'>): number {
  return a.position - b.position || a.name.localeCompare(b.name)
}

/** A subject's topics that pickers offer: not archived, in display order. */
export function activeTopics(topics: readonly TopicRow[] | undefined): TopicRow[] {
  return (topics ?? []).filter((topic) => !topic.archived).sort(byPosition)
}

/**
 * Another topic in the same subject with the same name (as the database compares them), or
 * undefined. Archived topics count: the name stays taken while a topic is archived.
 */
export function findDuplicateTopic(
  topics: readonly TopicRow[],
  subject: SubjectCode,
  name: string,
  exceptId?: string,
): TopicRow | undefined {
  const key = topicNameKey(name)
  return topics.find((topic) => topic.subject === subject && topic.id !== exceptId && topicNameKey(topic.name) === key)
}

/** Friendly copy for a name that is already taken. */
export function duplicateTopicMessage(existing: Pick<TopicRow, 'name' | 'archived'>): string {
  return existing.archived
    ? `You already have a topic called “${existing.name}”. It’s in Archived.`
    : `You already have a topic called “${existing.name}”.`
}

/** Number of cards filed under each topic id. */
export function countCardsByTopic(cards: readonly { topic_id: string | null }[] | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const card of cards ?? []) {
    if (card.topic_id) counts.set(card.topic_id, (counts.get(card.topic_id) ?? 0) + 1)
  }
  return counts
}

/** "1 card", "12 cards". */
export function cardCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`
}

/** A topic's name with its unit, e.g. "Sequences and series (P2)". */
export function topicLabel(topic: Pick<TopicRow, 'name' | 'unit'>): string {
  return topic.unit ? `${topic.name} (${topic.unit})` : topic.name
}

/**
 * The subject's topics for pickers (not archived, in order), plus every topic of the subject
 * (archived too) so an existing card's archived topic can still be shown.
 */
export function useActiveTopics(subject: SubjectCode) {
  const query = useTopics(subject)
  const active = useMemo(() => activeTopics(query.data), [query.data])
  return { ...query, active, all: query.data }
}
