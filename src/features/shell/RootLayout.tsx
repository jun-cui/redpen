import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../auth/authContext'
import { useToast } from '../../components'
import { ServiceWorkerToasts } from './ServiceWorkerToasts'

/** The router's top level: app-wide side effects, then whichever area the route is in. */
export function RootLayout() {
  return (
    <>
      <ServiceWorkerToasts />
      <LinkErrorNotice />
      <Outlet />
    </>
  )
}

/**
 * A failed email link normally lands on the sign-in page, which shows the message. If the person
 * is still signed in from before, it lands inside the app instead: say so in a toast and tidy the
 * error out of the address bar.
 */
function LinkErrorNotice() {
  const { status, linkError, clearLinkError } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const hasErrorHash = /(?:^#|&)error(?:_code)?=/.test(location.hash)

  useEffect(() => {
    if (status !== 'signedIn' || !linkError) return
    toast.show({ message: linkError, tone: 'error', duration: 8000 })
    clearLinkError()
  }, [status, linkError, clearLinkError, toast])

  useEffect(() => {
    if (status === 'signedIn' && hasErrorHash) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true })
    }
  }, [status, hasErrorHash, navigate, location.pathname, location.search])

  return null
}
