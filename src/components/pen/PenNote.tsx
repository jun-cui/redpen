import { motion } from 'motion/react'
import { useMemo } from 'react'
import { easings, PEN_DURATIONS } from '../../lib/motion'
import { cx } from '../cx'
import styles from './pen.module.css'

export interface PenNoteProps {
  /** The words the examiner writes. */
  children: string
  /** Show the note: written in when this becomes true. Default true. */
  drawn?: boolean
  /** Seconds before the pen starts. */
  delay?: number
  /** Seconds to write the whole note. */
  duration?: number
  /** Show the finished note at once. */
  instant?: boolean
  /** Element to render. Default span. */
  as?: 'span' | 'p' | 'div'
  className?: string
}

/** How long each word takes to appear. */
const WORD_FADE = 0.14

/**
 * Examiner's handwriting in red Caveat, written in word by word. Only opacity animates, so
 * reduced motion needs no special case. Screen readers get the plain text once.
 */
export function PenNote({
  children,
  drawn = true,
  delay = 0,
  duration = PEN_DURATIONS.note,
  instant = false,
  as: Tag = 'span',
  className,
}: PenNoteProps) {
  const tokens = useMemo(() => {
    let order = 0
    return children.split(/(\s+)/).map((text) => ({ text, order: text.trim() ? order++ : -1 }))
  }, [children])
  const words = tokens.filter((token) => token.order >= 0).length
  const fade = Math.min(WORD_FADE, duration)
  const step = words > 1 ? Math.max(duration - fade, 0) / (words - 1) : 0

  return (
    <Tag className={cx(styles.note, className)}>
      <span className="visually-hidden">{children}</span>
      <span aria-hidden="true">
        {tokens.map(({ text, order }, index) =>
          order < 0 ? (
            text
          ) : (
            <motion.span
              key={`${instant ? 'i' : 'w'}-${index}`}
              className={styles.word}
              initial={instant ? false : { opacity: 0 }}
              animate={{ opacity: drawn ? 1 : 0 }}
              transition={instant || !drawn ? { duration: 0 } : { delay: delay + order * step, duration: fade, ease: easings.out }}
            >
              {text}
            </motion.span>
          ),
        )}
      </span>
    </Tag>
  )
}
