import { CircleAlert, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { fades, springs } from '../../lib/motion'
import { IconButton } from '../Button/IconButton'
import styles from './Toast.module.css'
import { ToastContext, type ToastApi, type ToastOptions } from './toastContext'

interface Toast extends ToastOptions {
  id: string
}

/** Older toasts give way once this many are showing. */
const MAX_VISIBLE = 3

let nextId = 0

/** Provides useToast() and renders the toasts. Mount once near the app root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((options: ToastOptions) => {
    nextId += 1
    const id = `toast-${nextId}`
    setToasts((list) => {
      const others = typeof options.message === 'string' ? list.filter((toast) => toast.message !== options.message) : list
      return [...others, { ...options, id }].slice(-MAX_VISIBLE)
    })
    return id
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext value={api}>
      {children}
      {createPortal(
        <section className={styles.viewport} aria-label="Notifications">
          <div className={styles.list} aria-live="polite" aria-atomic="false">
            <AnimatePresence initial={false} mode="popLayout">
              {toasts.map((toast) => (
                <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
              ))}
            </AnimatePresence>
          </div>
        </section>,
        document.body,
      )}
    </ToastContext>
  )
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false)
  const duration = toast.duration ?? (toast.action ? 6000 : 4000)
  const remaining = useRef(duration)

  // The viewport rides above the on-screen keyboard on --keyboard-inset, which is only measured
  // while something tracks the keyboard. The tab bar does on phones, but wide screens (an iPad in
  // landscape) have no tab bar, so a showing toast tracks it too.
  useKeyboardInset()

  // Count down only while the reader isn't pointing at or focused inside the toast.
  useEffect(() => {
    if (paused || !Number.isFinite(remaining.current)) return
    const started = Date.now()
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - started
    }
  }, [paused, onDismiss, toast.id])

  return (
    <motion.div
      layout
      className={styles.toast}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { ...springs.gentle, opacity: fades.base } }}
      exit={{ opacity: 0, scale: 0.98, transition: fades.fast }}
      transition={springs.gentle}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      {toast.tone === 'error' ? <CircleAlert className={styles.icon} aria-hidden="true" strokeWidth={1.75} /> : null}
      <p className={styles.message}>{toast.message}</p>
      {toast.action ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action?.onClick()
            onDismiss(toast.id)
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <IconButton size="sm" label="Dismiss" icon={<X />} onClick={() => onDismiss(toast.id)} />
    </motion.div>
  )
}
