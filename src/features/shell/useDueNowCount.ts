import { useDueSummary } from '../../data/hooks'

/** Cards due right now, for the Review badge; null until known (or when it fails to load). */
export function useDueNowCount(): number | null {
  const { data } = useDueSummary()
  return data ? data.dueNow : null
}
