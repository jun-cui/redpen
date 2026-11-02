// The route table (see docs/ARCHITECTURE.md). Every page is lazy-loaded into its own chunk; the
// router waits for a page's code before it changes the location, so the page in view stays put
// (and can animate away) instead of flashing a fallback.

import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { PublicOnly, RequireAuth, RequireSession } from './auth/guards'
import { AuthLayout } from './features/auth/AuthLayout'
import { AppShell } from './features/shell/AppShell'
import { FocusLayout } from './features/shell/FocusLayout'
import {
  loadAuthConfirmPage,
  loadCardEditorPage,
  loadCardsPage,
  loadForgotPasswordPage,
  loadHomePage,
  loadLoginPage,
  loadReviewPage,
  loadSetPasswordPage,
  loadSettingsPage,
  loadTopicsPage,
} from './features/shell/pageModules'
import { RootLayout } from './features/shell/RootLayout'
import { AppSplash } from './features/system/AppSplash'
import { NotFoundPage } from './features/system/NotFoundPage'
import { RouteErrorPage } from './features/system/RouteErrorPage'

/** A route.lazy that loads a module and uses one of its named exports as the page. */
function page<M>(load: () => Promise<M>, pick: (module: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) })
}

/** Development only: the styleguide. Production builds drop the route and its chunk. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        id: 'styleguide',
        path: 'dev/styleguide',
        lazy: page(
          () => import('./dev/StyleguidePage'),
          (m) => m.StyleguidePage,
        ),
      },
    ]
  : []

export const routes: RouteObject[] = [
  {
    id: 'root',
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <AppSplash />,
    children: [
      // Signed-out screens share one frame.
      {
        element: <AuthLayout />,
        children: [
          {
            element: <PublicOnly />,
            children: [
              { id: 'login', path: 'login', lazy: page(loadLoginPage, (m) => m.LoginPage) },
              {
                id: 'forgot-password',
                path: 'forgot-password',
                lazy: page(loadForgotPasswordPage, (m) => m.ForgotPasswordPage),
              },
            ],
          },
          { id: 'auth-confirm', path: 'auth/confirm', lazy: page(loadAuthConfirmPage, (m) => m.AuthConfirmPage) },
          {
            element: <RequireSession />,
            children: [
              { id: 'set-password', path: 'set-password', lazy: page(loadSetPasswordPage, (m) => m.SetPasswordPage) },
            ],
          },
        ],
      },

      // The signed-in app.
      {
        element: <RequireAuth />,
        children: [
          // Focus mode: full screen, no navigation.
          {
            path: 'review',
            element: <FocusLayout />,
            errorElement: <RouteErrorPage />,
            children: [{ id: 'review', index: true, lazy: page(loadReviewPage, (m) => m.ReviewPage) }],
          },
          {
            element: <AppShell />,
            children: [
              {
                // Errors inside a page render within the shell, so navigation keeps working.
                errorElement: <RouteErrorPage />,
                children: [
                  { id: 'home', index: true, lazy: page(loadHomePage, (m) => m.HomePage) },
                  { id: 'cards', path: 'cards', lazy: page(loadCardsPage, (m) => m.CardsPage) },
                  { id: 'card-new', path: 'cards/new', lazy: page(loadCardEditorPage, (m) => m.CardEditorPage) },
                  { id: 'card-edit', path: 'cards/:cardId', lazy: page(loadCardEditorPage, (m) => m.CardEditorPage) },
                  { id: 'settings', path: 'settings', lazy: page(loadSettingsPage, (m) => m.SettingsPage) },
                  { id: 'topics', path: 'settings/topics', lazy: page(loadTopicsPage, (m) => m.TopicsPage) },
                  ...devRoutes,
                  { id: 'not-found', path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(routes)
}

export type AppRouter = ReturnType<typeof createAppRouter>
