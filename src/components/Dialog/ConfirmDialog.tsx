import { useRef, useState, type ReactNode } from 'react'
import { Button } from '../Button/Button'
import { Dialog } from './Dialog'

export interface ConfirmDialogProps {
  open: boolean
  /** Called on Cancel, Escape or a scrim tap. */
  onClose: () => void
  /**
   * Called on confirm. If it returns a promise the confirm button shows a spinner until it
   * settles; the dialog closes on success and stays open (for a toast or retry) on failure.
   */
  onConfirm: () => void | Promise<unknown>
  title: ReactNode
  /** What will happen, in a sentence or two. */
  children?: ReactNode
  /** Default "Confirm". Name the action: "Delete card". */
  confirmLabel?: string
  /** Default "Cancel". */
  cancelLabel?: string
  /** Use for actions that destroy something: red outline button, and Cancel takes initial focus. */
  destructive?: boolean
}

/** A short yes/no question before an action. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)

  const handleConfirm = async () => {
    const result = onConfirm()
    if (!(result instanceof Promise)) {
      onClose()
      return
    }
    setPending(true)
    try {
      await result
      onClose()
    } catch {
      // The caller reports the failure (e.g. with a toast); keep the dialog open to retry.
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title={title}
      description={children}
      hideClose
      initialFocus={destructive ? cancel : confirm}
      footer={
        <>
          <Button ref={cancel} variant={destructive ? 'secondary' : 'ghost'} onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button ref={confirm} variant={destructive ? 'danger' : 'primary'} loading={pending} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
