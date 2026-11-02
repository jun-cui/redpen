// Every lazily loaded page, in one place: the router loads them on navigation and the shell warms
// the main ones up once the app is idle. One import() per module, so each page is its own chunk.

export const loadHomePage = () => import('../home/HomePage')
export const loadReviewPage = () => import('../review/ReviewPage')
export const loadCardsPage = () => import('../cards/CardsPage')
export const loadCardEditorPage = () => import('../cards/CardEditorPage')
export const loadSettingsPage = () => import('../settings/SettingsPage')
export const loadTopicsPage = () => import('../topics/TopicsPage')

export const loadLoginPage = () => import('../auth/LoginPage')
export const loadForgotPasswordPage = () => import('../auth/ForgotPasswordPage')
export const loadSetPasswordPage = () => import('../auth/SetPasswordPage')
export const loadAuthConfirmPage = () => import('../auth/AuthConfirmPage')

/** Fetches the main destinations' code in the background, so the first visit to each is instant. */
export function prefetchMainPages(): () => void {
  const run = () => {
    for (const load of [loadHomePage, loadCardsPage, loadReviewPage, loadSettingsPage, loadCardEditorPage]) {
      load().catch(() => {
        // Offline or a stale deploy: the route loads (or reports the error) when it is visited.
      })
    }
  }
  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(run, { timeout: 4000 })
    return () => window.cancelIdleCallback(handle)
  }
  const timer = globalThis.setTimeout(run, 1500)
  return () => globalThis.clearTimeout(timer)
}
