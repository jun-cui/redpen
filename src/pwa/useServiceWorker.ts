import { useCallback, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Coming back to the app checks for an update, but not on every quick app switch. */
const MIN_CHECK_GAP_MS = 60 * 1000

export interface ServiceWorkerState {
  /** A new version is installed and waiting. `update` switches to it and reloads the page. */
  needRefresh: boolean
  /** The app shell has been cached for the first time: the app now opens offline. */
  offlineReady: boolean
  /** Activates the waiting version; the page reloads once it has taken control. */
  update: () => void
  /** Hides the prompt. A waiting version takes over once every Redpen tab or window has closed. */
  dismiss: () => void
}

interface Registration {
  url: string
  registration: ServiceWorkerRegistration
}

/**
 * Registers the service worker (prompt-to-update) and checks for new versions hourly and
 * whenever the app becomes visible again. Call it once, near the root; the app shell renders
 * the prompt. In development, and in browsers without service workers, it never reports
 * anything and `update` / `dismiss` do nothing harmful.
 */
export function useServiceWorker(): ServiceWorkerState {
  const [active, setActive] = useState<Registration | null>(null)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // Wait for the page's load event, so precaching never competes with the first render.
    immediate: false,
    onRegisteredSW(url, registration) {
      if (registration) setActive({ url, registration })
    },
    onRegisterError(error: unknown) {
      console.warn('Redpen: service worker registration failed', error)
    },
  })

  useEffect(() => {
    if (!active) return
    const { registration } = active
    let lastCheck = Date.now()

    const check = () => {
      if (registration.installing || !navigator.onLine) return
      lastCheck = Date.now()
      registration.update().catch(() => {
        // Offline or the server is unreachable: the next check tries again.
      })
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck >= MIN_CHECK_GAP_MS) check()
    }

    const timer = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [active])

  const update = useCallback(() => {
    // Already activated from another tab: this page's controller has switched, so nothing more
    // is coming, and the only step left is to load the new code.
    if (!active?.registration.waiting) {
      window.location.reload()
      return
    }
    // The plugin only reloads pages that already had a controller when they loaded, which leaves
    // out the session the app was installed in. Listen only from here on: with clientsClaim the
    // very first install changes the controller too, and that must not reload the page.
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    updateServiceWorker(true).catch((error: unknown) => {
      console.warn('Redpen: could not activate the new version', error)
    })
  }, [active, updateServiceWorker])

  const dismiss = useCallback(() => {
    setNeedRefresh(false)
    setOfflineReady(false)
  }, [setNeedRefresh, setOfflineReady])

  return { needRefresh, offlineReady, update, dismiss }
}
