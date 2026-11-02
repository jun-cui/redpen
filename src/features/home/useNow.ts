import { useEffect, useState } from 'react'

/**
 * The current time, refreshed every `intervalMs` (default a minute) and whenever the tab
 * becomes visible again, so greetings and "due in 3 hours" never go stale on an open page.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = window.setInterval(tick, intervalMs)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
