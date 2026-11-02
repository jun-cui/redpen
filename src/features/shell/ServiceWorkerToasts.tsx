import { useEffect } from 'react'
import { useToast } from '../../components'
import { useServiceWorker } from '../../pwa/useServiceWorker'

/**
 * Registers the service worker (once, at the root of the router) and turns its two signals into
 * toasts: a lasting "new version" prompt with Reload, and a brief note when offline use is ready.
 */
export function ServiceWorkerToasts() {
  const { needRefresh, offlineReady, update, dismiss } = useServiceWorker()
  const toast = useToast()

  useEffect(() => {
    if (!needRefresh) return
    const id = toast.show({
      message: 'A new version of Redpen is ready.',
      action: { label: 'Reload', onClick: update },
      duration: Infinity,
    })
    return () => toast.dismiss(id)
  }, [needRefresh, toast, update])

  useEffect(() => {
    if (!offlineReady || needRefresh) return
    toast.show({ message: 'Redpen now works offline.' })
    dismiss()
  }, [offlineReady, needRefresh, toast, dismiss])

  return null
}
