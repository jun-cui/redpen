import { ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { Sheet, SubjectBadge } from '../../components'
import { SUBJECTS } from '../../lib/subjects'
import type { SubjectCode } from '../../lib/types'
import styles from './SubjectDueList.module.css'

export interface SubjectDueListProps {
  /** Cards due now, per subject. Subjects with none are left out. */
  bySubject: Record<SubjectCode, number>
  className?: string
}

/** Due counts per subject, each a way straight into a review of just that subject. */
export function SubjectDueList({ bySubject, className }: SubjectDueListProps) {
  const headingId = useId()
  const subjects = SUBJECTS.filter((subject) => bySubject[subject.code] > 0)
  if (subjects.length === 0) return null

  return (
    <Sheet as="section" padding="none" className={className} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>
        By subject
      </h2>
      <ul role="list" className={styles.list}>
        {subjects.map((subject) => {
          const count = bySubject[subject.code]
          return (
            <li key={subject.code} className={styles.item}>
              <Link to={`/review?subject=${subject.code}`} className={styles.row}>
                <span className="visually-hidden">Review </span>
                <SubjectBadge subject={subject.code} className={styles.subject} />
                <span className={styles.count}>
                  <span className="visually-hidden">, </span>
                  {count}
                  <span className="visually-hidden"> due</span>
                </span>
                <ChevronRight className={styles.chevron} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
