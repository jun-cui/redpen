import { cx, Sheet, Skeleton } from '../../components'
import heroStyles from './DueHero.module.css'
import styles from './HomePage.module.css'

/** Placeholder rows for a side sheet: a title, then `rows` lines with a figure on the right. */
function SideSheetSkeleton({ rows, className }: { rows: number; className?: string }) {
  return (
    <Sheet padding="none" className={cx(styles.sideSkeleton, className)}>
      <Skeleton width={112} height={18} />
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={styles.sideSkeletonRow}>
          <Skeleton width={index % 2 === 0 ? 120 : 96} height={16} />
          <Skeleton width={20} height={20} />
        </span>
      ))}
    </Sheet>
  )
}

/** The dashboard's shape while the due counts load, so nothing jumps when they arrive. */
export function HomeSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true">
      <span role="status" className="visually-hidden">
        Loading your cards
      </span>
      <div className={styles.main}>
        <Sheet margin padding="lg" elevation="lifted" className={cx(heroStyles.hero, styles.hero)}>
          <Skeleton width={112} height={12} />
          <span className={heroStyles.body}>
            <span className={styles.statSkeleton}>
              <Skeleton width={80} height={56} />
              <Skeleton width={80} height={14} />
              <Skeleton width={104} height={12} />
            </span>
            <span className={styles.buttonSkeleton}>
              <Skeleton height={56} radius="sm" />
            </span>
          </span>
        </Sheet>
        <div className={styles.links}>
          <span className={styles.linkSkeleton}>
            <Skeleton height={48} radius="sm" />
          </span>
          <span className={styles.linkSkeleton}>
            <Skeleton height={48} radius="sm" />
          </span>
        </div>
      </div>
      <div className={styles.side}>
        <SideSheetSkeleton rows={3} className={styles.subjects} />
        <SideSheetSkeleton rows={4} className={styles.overview} />
      </div>
    </div>
  )
}
