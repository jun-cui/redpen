import { X } from 'lucide-react'
import { AnimatePresence, motion, useDragControls, useIsPresent, useReducedMotion, type PanInfo } from 'motion/react'
import { useEffect, useEffectEvent, useId, useRef, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useIsTabletUp } from '../../hooks/useMediaQuery'
import { useScrollLock } from '../../hooks/useScrollLock'
import { bottomSheetVariants, dialogVariants, fadeVariants, scrimVariants } from '../../lib/motion'
import { IconButton } from '../Button/IconButton'
import { cx } from '../cx'
import styles from './Dialog.module.css'

export interface DialogProps {
  open: boolean
  /** Called on Escape, scrim tap, the close button or a swipe down (when dismissible). */
  onClose: () => void
  title: ReactNode
  /** A sentence under the title; becomes the dialog's accessible description. */
  description?: ReactNode
  children?: ReactNode
  /** Action buttons, in reading order (e.g. Cancel then Save). Stacked on phones, primary on top. */
  footer?: ReactNode
  /** md: 480px (default); wide: 640px. Phones always use a full-width bottom sheet. */
  size?: 'md' | 'wide'
  /** Element to focus on open. Default: the dialog itself, so its title is announced first. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Where focus goes on close if the element that opened the dialog has gone (or nothing had focus). */
  returnFocus?: () => HTMLElement | null
  /** Whether Escape, the scrim, the close button and swiping down close it. Default true. */
  dismissible?: boolean
  /** Hide the close button (e.g. when the footer has a Cancel button). */
  hideClose?: boolean
  className?: string
}

/** Open dialogs, innermost last: only the innermost one responds to Escape. */
const openDialogs: object[] = []

/** How far (px) or how fast (px/s) a downward swipe must go to dismiss the bottom sheet. */
const SWIPE_DISTANCE = 96
const SWIPE_VELOCITY = 500

/**
 * A modal dialog: a bottom sheet on phones (swipe down to dismiss), a centred sheet of paper on
 * larger screens. Traps focus, closes on Escape or a scrim tap, restores focus on close, and
 * locks the page behind it.
 */
export function Dialog(props: DialogProps) {
  return createPortal(<AnimatePresence>{props.open ? <DialogPanel key="dialog" {...props} /> : null}</AnimatePresence>, document.body)
}

function DialogPanel({
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocus,
  returnFocus,
  dismissible = true,
  hideClose = false,
  className,
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const tabletUp = useIsTabletUp()
  const reduceMotion = useReducedMotion()
  const dragControls = useDragControls()
  // False while the exit animation plays: focus goes back to the opener at once and the
  // closing dialog stops taking input.
  const present = useIsPresent()
  const canDismiss = dismissible && present

  useFocusTrap(panel, present, { initialFocus: initialFocus ?? panel, returnFocus })
  useScrollLock(true)
  useKeyboardInset()

  const onEscape = useEffectEvent(() => {
    if (canDismiss) onClose()
  })

  // Registered once per open dialog, so a re-render (a new inline onClose) never reorders the stack.
  useEffect(() => {
    const token = {}
    openDialogs.push(token)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || openDialogs[openDialogs.length - 1] !== token) return
      event.preventDefault()
      onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openDialogs.splice(openDialogs.indexOf(token), 1)
    }
  }, [])

  const swipeable = !tabletUp && canDismiss
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > SWIPE_DISTANCE || info.velocity.y > SWIPE_VELOCITY) onClose()
  }
  /** A swipe can start on the handle or anywhere in the header, except on a control there. */
  const startSwipe = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('a, button')) return
    dragControls.start(event)
  }

  return (
    <div className={cx(styles.viewport, !present && styles.leaving)}>
      <motion.div
        className={styles.scrim}
        variants={scrimVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={canDismiss ? onClose : undefined}
        aria-hidden="true"
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(styles.panel, size === 'wide' && styles.wide, className)}
        variants={reduceMotion ? fadeVariants : tabletUp ? dialogVariants : bottomSheetVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        drag={swipeable ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={swipeable ? onDragEnd : undefined}
      >
        {!tabletUp ? (
          <div className={styles.handle} aria-hidden="true" onPointerDown={swipeable ? startSwipe : undefined} />
        ) : null}
        <div className={styles.header} onPointerDown={swipeable ? startSwipe : undefined}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {dismissible && !hideClose ? <IconButton label="Close" icon={<X />} onClick={onClose} className={styles.close} /> : null}
          {description ? (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          ) : null}
        </div>
        {children !== undefined && children !== null ? <div className={styles.body}>{children}</div> : null}
        {footer ? <div className={styles.footer}>{footer}</div> : <div className={styles.noFooter} />}
      </motion.div>
    </div>
  )
}
