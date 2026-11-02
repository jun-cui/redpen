import { cx, Sheet, SubjectBadge } from '../../components'
import type { KeyPoint, SubjectCode } from '../../lib/types'
import { marksLabel } from './cardFilters'
import styles from './CardPreview.module.css'

export interface CardPreviewProps {
  subject: SubjectCode
  /** The topic's name; null for no topic, undefined while it loads. */
  topicName: string | null | undefined
  question: string
  points: readonly KeyPoint[]
  className?: string
}

/**
 * A guide to how the card will read: the question set as on the review sheet at phone size, with
 * the marks it carries, and its mark scheme below.
 */
export function CardPreview({ subject, topicName, question, points, className }: CardPreviewProps) {
  const text = question.trim()
  return (
    <div className={cx(styles.preview, className)}>
      <Sheet margin elevation="lifted" className={styles.paper}>
        <div className={styles.head}>
          <p className={styles.meta}>
            <SubjectBadge subject={subject} />
            {topicName !== undefined ? <span className={styles.topic}>{topicName ?? 'No topic'}</span> : null}
          </p>
          <p className={styles.tally}>
            <span aria-hidden="true">({points.length})</span>
            <span className="visually-hidden">{marksLabel(points.length)}</span>
          </p>
        </div>
        <p className={cx(styles.question, !text && styles.placeholder)}>{text || 'Your question appears here.'}</p>
      </Sheet>

      <Sheet elevation="flat" padding="md" className={styles.scheme}>
        <h3 className={styles.schemeTitle}>Mark scheme</h3>
        {points.length === 0 ? (
          <p className={styles.placeholder}>No key points yet.</p>
        ) : (
          <ol role="list" className={styles.schemeList}>
            {points.map((kp, index) => {
              const point = kp.point.trim()
              return (
                <li key={kp.id} className={styles.schemeItem}>
                  <span className={styles.schemeNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className={styles.schemeBody}>
                    <p className={cx(styles.schemePoint, !point && styles.placeholder)}>
                      {point || 'Not written yet'}
                    </p>
                    {kp.accept.length > 0 ? (
                      <p className={styles.schemeNote}>
                        <span className={styles.noteLabel}>Accept</span> {kp.accept.join('; ')}
                      </p>
                    ) : null}
                    {kp.reject.length > 0 ? (
                      <p className={styles.schemeNote}>
                        <span className={styles.noteLabel}>Do not accept</span> {kp.reject.join('; ')}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Sheet>
    </div>
  )
}
