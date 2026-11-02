import { useCallback, useEffect, useRef } from 'react'
import { useBlocker, type Blocker, type BlockerFunction } from 'react-router'
import { ConfirmDialog } from '../../components'

/**
 * While `dirty`, leaving the page asks first: in-app navigation through the router's blocker
 * (show <DiscardChangesDialog blocker={blocker} />), and closing or reloading the tab through
 * the browser's own prompt. Call `allowNavigation()` just before navigating away on purpose
 * (after saving or deleting).
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const bypass = useRef(false)

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      dirty && !bypass.current && currentLocation.pathname !== nextLocation.pathname,
    [dirty],
  )
  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Safari only prompts when returnValue is set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const allowNavigation = useCallback(() => {
    bypass.current = true
  }, [])

  return { blocker, allowNavigation }
}

/** "Discard changes?" for a blocked navigation: Discard carries on, Keep editing stays. */
export function DiscardChangesDialog({ blocker }: { blocker: Blocker }) {
  // After Discard the dialog closes too; that close must not cancel the navigation.
  const proceeding = useRef(false)
  useEffect(() => {
    if (blocker.state === 'blocked') proceeding.current = false
  }, [blocker.state])

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={() => {
        if (!proceeding.current) blocker.reset?.()
      }}
      onConfirm={() => {
        proceeding.current = true
        blocker.proceed?.()
      }}
      title="Discard changes?"
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
    >
      Your changes to this card haven’t been saved.
    </ConfirmDialog>
  )
}
