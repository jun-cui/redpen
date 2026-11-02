// The card library's filters: read from and written to the URL, applied to the card list.

import type { CardRow } from '../../lib/database.types'
import { formatRelativeDue } from '../../lib/dates'
import { isSubjectCode } from '../../lib/subjects'
import type { CardCategory, SubjectCode } from '../../lib/types'

export type SortKey = 'due' | 'recent' | 'score'

export const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: 'due', label: 'Due soonest' },
  { value: 'recent', label: 'Recently added' },
  { value: 'score', label: 'Lowest last score' },
]

/** Category chips, in the order a card moves through them. */
export const FILTER_CATEGORIES: readonly CardCategory[] = ['new', 'learning', 'weak', 'mastered']

/** The topic filter's value for cards without a topic. */
export const NO_TOPIC = 'none'

export interface CardFilters {
  /** Search text as typed. */
  q: string
  subject: SubjectCode | null
  /** Empty means every category. */
  categories: CardCategory[]
  /** A topic id, NO_TOPIC, or null for every topic. Only used with a subject. */
  topic: string | null
  sort: SortKey
}

const PARAM = { q: 'q', subject: 'subject', category: 'category', topic: 'topic', sort: 'sort' } as const

function isCategory(value: string): value is CardCategory {
  return (FILTER_CATEGORIES as readonly string[]).includes(value)
}

function isSortKey(value: string | null): value is SortKey {
  return value === 'due' || value === 'recent' || value === 'score'
}

/** Filters from the URL; anything unknown falls back to the default. */
export function readFilters(params: URLSearchParams): CardFilters {
  const subject = params.get(PARAM.subject)
  const sort = params.get(PARAM.sort)
  const categories = (params.get(PARAM.category) ?? '')
    .split(',')
    .filter(isCategory)
    .filter((value, index, list) => list.indexOf(value) === index)
  const validSubject = isSubjectCode(subject) ? subject : null
  return {
    q: params.get(PARAM.q) ?? '',
    subject: validSubject,
    categories: FILTER_CATEGORIES.filter((category) => categories.includes(category)),
    topic: validSubject ? params.get(PARAM.topic) || null : null,
    sort: isSortKey(sort) ? sort : 'due',
  }
}

/** URL params for the filters, leaving out defaults so plain /cards stays plain. */
export function writeFilters(filters: CardFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set(PARAM.q, filters.q)
  if (filters.subject) params.set(PARAM.subject, filters.subject)
  if (filters.categories.length > 0) params.set(PARAM.category, filters.categories.join(','))
  if (filters.subject && filters.topic) params.set(PARAM.topic, filters.topic)
  if (filters.sort !== 'due') params.set(PARAM.sort, filters.sort)
  return params
}

/** Whether anything narrows the list (sorting doesn't). */
export function hasActiveFilters(filters: CardFilters): boolean {
  return Boolean(filters.q.trim() || filters.subject || filters.categories.length > 0 || filters.topic)
}

/** Lower case without accents, so "Schrodinger" finds "Schrödinger". */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('en-GB')
}

/** Folded search terms; every term must match. */
export function searchTerms(query: string): string[] {
  return foldText(query).split(/\s+/).filter(Boolean)
}

/** What a search looks through: the question and every key point with its accepted wordings. */
export function searchableText(card: Pick<CardRow, 'question' | 'key_points'>): string {
  const points = card.key_points.flatMap((kp) => [kp.point, ...kp.accept])
  return foldText([card.question, ...points].join('\n'))
}

export interface FilterContext {
  /** searchableText per card id (computed once per list). */
  text: ReadonlyMap<string, string>
  terms: readonly string[]
}

/** Every filter except the categories: the set the category chips count. */
export function matchesBaseFilters(card: CardRow, filters: CardFilters, context: FilterContext): boolean {
  if (filters.subject && card.subject !== filters.subject) return false
  if (filters.subject && filters.topic) {
    if (filters.topic === NO_TOPIC ? card.topic_id !== null : card.topic_id !== filters.topic) return false
  }
  if (context.terms.length > 0) {
    const text = context.text.get(card.id) ?? ''
    if (!context.terms.every((term) => text.includes(term))) return false
  }
  return true
}

export function matchesCategory(card: CardRow, categories: readonly CardCategory[]): boolean {
  return categories.length === 0 || categories.includes(card.category)
}

function time(value: string | null): number {
  const ms = value ? Date.parse(value) : NaN
  return Number.isNaN(ms) ? Infinity : ms
}

/** Sorted copy. Paused cards go last when sorting by due date; unscored cards last by score. */
export function sortCards(cards: readonly CardRow[], sort: SortKey): CardRow[] {
  const list = [...cards]
  const byDue = (a: CardRow, b: CardRow) => Number(a.suspended) - Number(b.suspended) || time(a.due) - time(b.due)
  const byNewest = (a: CardRow, b: CardRow) => time(b.created_at) - time(a.created_at)
  if (sort === 'due') return list.sort((a, b) => byDue(a, b) || byNewest(a, b))
  if (sort === 'recent') return list.sort((a, b) => byNewest(a, b) || byDue(a, b))
  return list.sort((a, b) => {
    const sa = a.last_score ?? Infinity
    const sb = b.last_score ?? Infinity
    return (sa === sb ? 0 : sa - sb) || byDue(a, b)
  })
}

/**
 * Due within this counts as due now: formatRelativeDue already says "now" under half a minute,
 * and a card saved a moment after the page read the clock should look due, not "Due in 0 min".
 */
const DUE_NOW_TOLERANCE_MS = 30_000

/** Whether the card is due now (and not paused). An unreadable date counts as due. */
export function isDueNow(card: Pick<CardRow, 'due' | 'suspended'>, now: Date): boolean {
  if (card.suspended) return false
  const due = Date.parse(card.due)
  return Number.isNaN(due) || due - now.getTime() < DUE_NOW_TOLERANCE_MS
}

/** "Due now", "Due tomorrow", "Due in 3 days", or "Paused" for a suspended card. */
export function dueLabel(card: Pick<CardRow, 'due' | 'suspended'>, now: Date): string {
  if (card.suspended) return 'Paused'
  if (isDueNow(card, now)) return 'Due now'
  return `Due ${formatRelativeDue(new Date(card.due), now)}`
}

/** "1 mark", "4 marks". */
export function marksLabel(count: number): string {
  return `${count} ${count === 1 ? 'mark' : 'marks'}`
}
