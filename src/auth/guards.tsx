// Route guards: layout routes that render their children or redirect.

import { Fragment } from 'react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { AppSplash } from '../features/system/AppSplash'
import { useAuth } from './authContext'
import { loginPathFor, safeNextPath, useAuthFlow } from './authFlow'

/**
 * The signed-in app. Signed out: to /login, coming back here afterwards (unless the person
 * signed out on purpose). Mid-way through an invite or reset link: to /set-password first.
 */
export function RequireAuth() {
  const { status, user, passwordSetup } = useAuth()
  const { signedOutByUser } = useAuthFlow()
  const location = useLocation()

  if (status === 'loading') return <AppSplash />
  if (status === 'signedOut') {
    const to = signedOutByUser ? '/login' : loginPathFor(`${location.pathname}${location.search}`)
    return <Navigate to={to} replace />
  }
  if (passwordSetup) return <Navigate to="/set-password" replace />
  // Keyed by user: if a different person signs in, every page and query starts afresh.
  return (
    <Fragment key={user?.id}>
      <Outlet />
    </Fragment>
  )
}

/** Sign-in and forgot-password: someone already signed in goes on into the app. */
export function PublicOnly() {
  const { status, passwordSetup } = useAuth()
  const [searchParams] = useSearchParams()

  if (status === 'loading') return <AppSplash />
  if (status === 'signedIn') {
    const to = passwordSetup ? '/set-password' : (safeNextPath(searchParams.get('next')) ?? '/')
    return <Navigate to={to} replace />
  }
  return <Outlet />
}

/** /set-password: needs a session (from an invite or reset link, or an ordinary sign-in). */
export function RequireSession() {
  const { status } = useAuth()
  if (status === 'loading') return <AppSplash />
  if (status === 'signedOut') return <Navigate to="/login" replace />
  return <Outlet />
}
