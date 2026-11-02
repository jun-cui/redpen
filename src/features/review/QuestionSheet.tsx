import type { Ref } from 'react'
import { cx, Sheet, SubjectBadge } from '../../components'
import type { SubjectCode } from '../../lib/types'
import styles from './QuestionSheet.module.css'

export interface QuestionSheetProps {
  question: string
  subject: SubjectCode
  /** The card's topic, when it has one. */
  topicName?: string | null
  /** How many marks the question is worth (its key points). */
  marks: number
  /** The question's number in the session, printed in the margin like an exam paper. */
  number?: number
  /** id for the question heading (the sheet is labelled by it). */
  headingId: string
  /** The heading takes focus when a new card arrives on touch devices (for screen readers). */
  headingRef?: Ref<HTMLHeadingElement>
  className?: string
}

/**
 * The question on its own sheet, set like a printed paper: number in the margin, subject and
 * topic above with the marks available at the right, and the question in the serif.
 */
export function QuestionSheet({ question, subject, topicName, marks, number, headingId, headingRef, className }: QuestionSheetProps) {
  const marksLabel = `${marks} ${marks === 1 ? 'mark' : 'marks'}`
  return (
    <Sheet as="section" elevation="lifted" margin aria-labelledby={headingId} className={cx(styles.sheet, className)}>
      <div className={styles.head}>
        <div className={styles.eyebrow}>
          <p className={styles.eyebrowItems}>
            <SubjectBadge subject={subject} className={styles.eyebrowItem} />
            {topicName ? <span className={cx(styles.eyebrowItem, styles.topic)}>{topicName}</span> : null}
          </p>
        </div>
        <p className={styles.tally}>
          <span aria-hidden="true">({marks})</span>
          <span className="visually-hidden">{marksLabel}</span>
        </p>
      </div>
      <div className={styles.body}>
        {number !== undefined ? (
          <span className={styles.number} aria-hidden="true">
            {number}
          </span>
        ) : null}
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.question}>
          {question}
        </h2>
      </div>
    </Sheet>
  )
}
