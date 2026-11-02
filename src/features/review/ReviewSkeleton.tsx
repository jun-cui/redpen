import { Sheet, Skeleton, SkeletonText } from '../../components'
import styles from './ReviewSkeleton.module.css'

/** Loading the session: shaped like the question sheet and the answer sheet below it. */
export function ReviewSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className="visually-hidden" role="status">
        Loading your cards
      </span>
      <Sheet elevation="lifted" margin className={styles.question}>
        <Skeleton width={112} height={24} radius="pill" />
        <SkeletonText size="question" lines={3} lastLineWidth="55%" />
        <Skeleton width={28} height={18} className={styles.tally} />
      </Sheet>
      <div className={styles.columns}>
        <Sheet ruled margin className={styles.answer}>
          <Skeleton width={96} height={12} className={styles.label} />
        </Sheet>
        <Sheet elevation="flat" margin className={styles.cover}>
          <Skeleton width={140} height={22} />
          <SkeletonText size="sm" lines={2} lastLineWidth="70%" />
        </Sheet>
      </div>
    </div>
  )
}
