import { describe, expect, it } from 'vitest'
import {
  calendarDaysBetween,
  endOfLocalDay,
  formatRelativeDue,
  formatShortDate,
  startOfLocalDay,
} from './dates'

// Built from local-time parts so the cases hold in any time zone.
const NOW = new Date(2026, 9, 21, 10, 0, 0)
const MINUTE = 60_000
const HOUR = 60 * MINUTE

function at(ms: number): Date {
  return new Date(NOW.getTime() + ms)
}

function daysLater(days: number, hours = 10): Date {
  return new Date(2026, 9, 21 + days, hours, 0, 0)
}

describe('formatRelativeDue', () => {
  it.each([
    ['overdue', at(-3 * HOUR), 'now'],
    ['due this moment', NOW, 'now'],
    ['under a minute', at(25_000), 'now'],
    ['one minute', at(MINUTE), 'in 1 min'],
    ['ten minutes', at(10 * MINUTE), 'in 10 min'],
    ['59 minutes', at(59 * MINUTE), 'in 59 min'],
    ['an hour', at(HOUR), 'in 1 hour'],
    ['three hours', at(3 * HOUR), 'in 3 hours'],
    ['later tonight', at(13 * HOUR), 'in 13 hours'],
    ['tomorrow morning, under a day away', daysLater(1, 9), 'in 23 hours'],
    ['tomorrow', daysLater(1), 'tomorrow'],
    ['tomorrow evening', daysLater(1, 22), 'tomorrow'],
    ['three days', daysLater(3), 'in 3 days'],
    ['thirteen days', daysLater(13), 'in 13 days'],
    ['two weeks', daysLater(14), 'in 2 weeks'],
    ['seven weeks', daysLater(50), 'in 7 weeks'],
    ['three months', daysLater(91), 'in 3 months'],
    ['eleven months', daysLater(335), 'in 11 months'],
    ['almost a year', daysLater(360), 'in 1 year'],
    ['a year', daysLater(370), 'in 1 year'],
    ['two years', daysLater(730), 'in 2 years'],
  ])('%s', (_label, due, expected) => {
    expect(formatRelativeDue(due, NOW)).toBe(expected)
  })
})

describe('local days', () => {
  it('finds the start and end of the local day', () => {
    expect(startOfLocalDay(NOW)).toEqual(new Date(2026, 9, 21, 0, 0, 0, 0))
    expect(endOfLocalDay(NOW)).toEqual(new Date(2026, 9, 21, 23, 59, 59, 999))
  })

  it('counts calendar days, not 24-hour periods', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 21, 23, 30), new Date(2026, 9, 22, 0, 30))).toBe(1)
    expect(calendarDaysBetween(NOW, NOW)).toBe(0)
    expect(calendarDaysBetween(NOW, daysLater(40))).toBe(40)
    expect(calendarDaysBetween(daysLater(2), NOW)).toBe(-2)
  })
})

describe('formatShortDate', () => {
  it('leaves out the year for dates this year', () => {
    expect(formatShortDate(new Date(2026, 2, 5), NOW)).toBe('5 Mar')
  })

  it('includes the year otherwise', () => {
    expect(formatShortDate(new Date(2025, 9, 21), NOW)).toBe('21 Oct 2025')
  })

  it('accepts ISO strings and ignores invalid ones', () => {
    expect(formatShortDate(new Date(2026, 9, 21, 12).toISOString(), NOW)).toBe('21 Oct')
    expect(formatShortDate('not a date', NOW)).toBe('')
  })
})
