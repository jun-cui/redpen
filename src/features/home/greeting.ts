// Words for the top of the home page: a time-of-day greeting and today's date.

/** "Good morning" (5:00–11:59), "Good afternoon" (12:00–17:59) or "Good evening". */
export function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "Good evening, Jun", or just "Good evening" without a name. */
export function greetingWithName(date: Date, name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed ? `${greetingFor(date)}, ${trimmed}` : greetingFor(date)
}

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** "Friday 23 October". */
export function formatLongDate(date: Date): string {
  return longDate.format(date)
}

/** The local calendar date as YYYY-MM-DD, for <time dateTime>. */
export function localIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "1 card" / "12 cards". */
export function cardCount(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`
}
