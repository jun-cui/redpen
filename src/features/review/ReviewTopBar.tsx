import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { IconButton, ProgressBar } from '../../components'
import { fades } from '../../lib/motion'
import type { QueueProgress } from './queue'
import styles from './ReviewTopBar.module.css'

/** How long "Marks saved · Change marks" stays in the bar after a save. */
const SAVED_NOTICE_MS = 5000

export interface SavedNotice {
  /** Identifies the save: a new one restarts the count. */
  key: string
  onChangeMarks: () => void
  /** The notice has had its time: the title comes back. */
  onDone: () => void
}

export interface ReviewTopBarProps {
  /** Leaves the session (asks first when an answer would be lost). */
  onClose: () => void
  /** The subject the session is limited to, when it is. */
  subjectName?: string | null
  /** Where the session is; omitted while loading or when there is nothing to review. */
  progress?: QueueProgress | null
  /** Just after a save: a way to change those marks stands in for the title for a few seconds. */
  saved?: SavedNotice | null
}

const swap = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: fades.fast },
  exit: { opacity: 0, transition: fades.fast },
}

/** Focus mode's only chrome: a way out, and how far through the session you are. */
export function ReviewTopBar({ onClose, subjectName, progress, saved }: ReviewTopBarProps) {
  const counting = progress && progress.total > 0
  return (
    <header className={styles.bar}>
      <IconButton label="Close review" icon={<X />} onClick={onClose} className={styles.close} />
      <div className={styles.meter}>
        <div className={styles.labels}>
          <div className={styles.slot}>
            <AnimatePresence mode="wait" initial={false}>
              {saved ? (
                <motion.div key="saved" className={styles.saved} {...swap}>
                  <SavedNoticeLine notice={saved} />
                </motion.div>
              ) : (
                <motion.p key="title" className={styles.title} {...swap}>
                  {subjectName ?? 'Review'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          {counting ? (
            <p className={styles.count} aria-hidden="true">
              <span className="tabular-nums">{Math.max(progress.position, 1)}</span>
              <span className={styles.of}> of </span>
              <span className="tabular-nums">{progress.total}</span>
            </p>
          ) : null}
        </div>
        <ProgressBar
          value={counting ? progress.completed : 0}
          max={counting ? progress.total : 1}
          label="Review progress"
          valueText={
            counting ? `${progress.completed} of ${progress.total} ${progress.total === 1 ? 'card' : 'cards'} marked` : undefined
          }
          className={styles.progress}
        />
      </div>
      {/* Says so once per save; the line itself comes and goes without a word. */}
      <p className="visually-hidden" role="status">
        {saved ? 'Marks saved' : ''}
      </p>
    </header>
  )
}

/**
 * "Marks saved · Change marks". It counts down only while nobody is pointing at it or focused in
 * it, so it never disappears from under the pointer or a keyboard user.
 */
function SavedNoticeLine({ notice }: { notice: SavedNotice }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(SAVED_NOTICE_MS)
  const done = useEffectEvent(() => notice.onDone())

  // A new save starts the count again. (React stops the countdown below before this runs.)
  useEffect(() => {
    remaining.current = SAVED_NOTICE_MS
  }, [notice.key])

  useEffect(() => {
    if (paused) return
    const started = Date.now()
    const timer = window.setTimeout(() => done(), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - started
    }
  }, [paused, notice.key])

  return (
    <p
      className={styles.savedLine}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <span className={styles.savedLong}>Marks saved</span>
      <span className={styles.savedShort}>Saved</span>
      <span className={styles.dot} aria-hidden="true">
        ·
      </span>
      <button type="button" className={styles.change} onClick={notice.onChangeMarks}>
        Change marks
      </button>
    </p>
  )
}
