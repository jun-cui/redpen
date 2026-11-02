import { Library, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { ButtonLink } from '../../components'
import type { DueSummary } from '../../data/api'
import { fadeVariants, riseVariants, staggerVariants } from '../../lib/motion'
import type { CardCategory } from '../../lib/types'
import { CardBoxOverview } from './CardBoxOverview'
import { CaughtUpHero, DueHero } from './DueHero'
import { SubjectDueList } from './SubjectDueList'
import styles from './HomePage.module.css'

const stagger = staggerVariants(0.05)

function activeCards(byCategory: Record<CardCategory, number>): number {
  return byCategory.new + byCategory.learning + byCategory.weak + byCategory.mastered
}

export interface HomeDashboardProps {
  summary: DueSummary
  now: Date
  /** 'hidden' to rise in (replacing the skeleton or the welcome sheet); false to appear as it is. */
  enter: 'hidden' | false
}

/**
 * The home page for someone with cards: the due hero, ways in by subject, quick links and the card
 * box at a glance. Phones get one column; desktops put the hero on the left and the rest beside it.
 */
export function HomeDashboard({ summary, now, enter }: HomeDashboardProps) {
  const due = summary.dueNow > 0

  return (
    <motion.div className={styles.layout} variants={stagger} initial={enter} animate="visible">
      <div className={styles.main}>
        <motion.div variants={riseVariants} className={styles.hero}>
          {/* When cards come due while the page is open, the caught-up sheet gives way to the count. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={due ? 'due' : 'clear'} variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
              {due ? (
                <DueHero dueNow={summary.dueNow} dueLaterToday={summary.dueLaterToday} />
              ) : (
                <CaughtUpHero
                  nextDueAt={summary.nextDueAt}
                  dueLaterToday={summary.dueLaterToday}
                  activeCards={activeCards(summary.byCategory)}
                  now={now}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.nav variants={riseVariants} className={styles.links} aria-label="Cards">
          <ButtonLink to="/cards/new" leadingIcon={<Plus />} className={styles.link}>
            New card
          </ButtonLink>
          <ButtonLink to="/cards" leadingIcon={<Library />} className={styles.link}>
            Browse cards
          </ButtonLink>
        </motion.nav>
      </div>

      <div className={styles.side}>
        {due ? (
          <motion.div variants={riseVariants} className={styles.subjects}>
            <SubjectDueList bySubject={summary.bySubject} />
          </motion.div>
        ) : null}
        <motion.div variants={riseVariants} className={styles.overview}>
          <CardBoxOverview byCategory={summary.byCategory} total={summary.total} />
        </motion.div>
      </div>
    </motion.div>
  )
}
