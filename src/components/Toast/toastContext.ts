import { createContext, useContext, type ReactNode } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  message: ReactNode
  /** error adds a red alert icon. Default default. */
  tone?: 'default' | 'error'
  /** One short action, e.g. Undo. The toast closes when it is used. */
  action?: ToastAction
  /** Milliseconds before it closes: default 4000, or 6000 with an action. Infinity keeps it open. */
  duration?: number
}

export interface ToastApi {
  /** Shows a toast and returns its id. Showing the same message again restarts it rather than stacking. */
  show: (options: ToastOptions) => string
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

/** Show brief, non-blocking messages: useToast().show({ message: 'Card saved' }). */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}
