import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from './auth/AuthProvider'
import { IconProvider, ToastProvider } from './components'
import { createQueryClient } from './data/hooks'
import { SetupRequiredPage } from './features/system/SetupRequiredPage'
import { isDemoMode, isSupabaseConfigured } from './lib/env'
import { createAppRouter } from './router'

/**
 * A production build made without its Supabase settings, or with a secret key where the
 * publishable one belongs, can't safely start.
 */
const needsSetup = !isSupabaseConfigured && !isDemoMode

export function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => (needsSetup ? null : createAppRouter()))

  return (
    <MotionConfig reducedMotion="user">
      <IconProvider>
        {router ? (
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <AuthProvider>
                <RouterProvider router={router} />
              </AuthProvider>
            </ToastProvider>
          </QueryClientProvider>
        ) : (
          <SetupRequiredPage />
        )}
      </IconProvider>
    </MotionConfig>
  )
}
