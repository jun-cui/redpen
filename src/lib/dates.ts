// Date helpers. Days are local calendar days: "tomorrow" means the user's tomorrow.

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

/** Whole local calendar days from `from` to `to` (DST-safe). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / (24 * HOUR))
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

/**
 * When something is next due, in calm plain words: "now", "in 10 min", "in 3 hours",
 * "tomorrow", "in 3 days", "in 2 weeks", "in 3 months", "in 1 year".
 */
export function formatRelativeDue(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime()
  const minutes = Math.round(ms / MINUTE)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `in ${minutes} min`

  const hours = Math.round(ms / HOUR)
  if (hours < 24) return `in ${plural(hours, 'hour')}`

  const days = calendarDaysBetween(now, due)
  if (days < 1) return `in ${plural(hours, 'hour')}`
  if (days === 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  if (days < 60) return `in ${plural(Math.round(days / 7), 'week')}`
  const months = Math.round(days / 30.44)
  if (months < 12) return `in ${plural(months, 'month')}`
  return `in ${plural(Math.max(1, Math.round(days / 365.25)), 'year')}`
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const shortDateWithYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** "21 Oct", or "21 Oct 2025" when the date is not in the current year. */
export function formatShortDate(date: Date | string, now: Date = new Date()): string {
  const value = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(value.getTime())) return ''
  return value.getFullYear() === now.getFullYear()
    ? shortDate.format(value)
    : shortDateWithYear.format(value)
}
