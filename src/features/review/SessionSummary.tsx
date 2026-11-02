import { ArrowRight, Home, PencilLine } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { BrandMark, Button, ButtonLink, cx, ScoreMark, Sheet, Stat, SubjectBadge } from '../../components'
import { fades, riseVariants, springs, staggerVariants } from '../../lib/motion'
import { subjectInfo } from '../../lib/subjects'
import type { SubjectCode } from '../../lib/types'
import { useNow } from '../cards/useNow'
import { cardCount, comeBackLabel, nextReviewLabel } from './copy'
import type { HeldCards } from './queue'
import { sessionStats, summaryRows, type SessionRecord } from './sessionRecords'
import styles from './SessionSummary.module.css'

export interface SessionSummaryProps {
  records: readonly SessionRecord[]
  /** The session was limited to one subject. */
  subject?: SubjectCode
  /** Cards that have come due since the session started (0 hides "Keep going"). */
  moreDue: number
  /** Cards from this session that come back once they are due again (learning steps). */
  held?: HeldCards
  onKeepGoing: () => void
  keepingGoing?: boolean
  /** Opens a saved answer's marks to change them. */
  onChangeMarks: (recordKey: string) => void
}

/** The end of a session: a calm headline, how it went, and every card with its new schedule. */
export function SessionSummary({
  records,
  subject,
  moreDue,
  held,
  onKeepGoing,
  keepingGoing = false,
  onChangeMarks,
}: SessionSummaryProps) {
  const stats = useMemo(() => sessionStats(records), [records])
  const rows = useMemo(() => summaryRows(records), [records])
  // Kept current, so "in 8 min" stays true while the summary is open.
  const now = useNow()
  const subjectName = subject ? subjectInfo(subject).name : null
  const titleRef = useRef<HTMLHeadingElement>(null)

  // The last card took focus with it: the headline has it next, so screen readers announce it.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [])

  const title = moreDue > 0 ? 'Session done.' : 'Desk clear.'
  const lead =
    moreDue > 0
      ? `${cardCount(moreDue)} ${moreDue === 1 ? 'has' : 'have'} come due since you started.`
      : `That’s every ${subjectName ? `${subjectName} ` : ''}card that was due.`
  // Once one has come due, the lead says so and "Keep going" picks it up instead.
  const comeBack = moreDue === 0 && held ? comeBackLabel(held, now) : null

  return (
    <div className={styles.summary}>
      <header className={styles.header}>
        <BrandMark size={56} animated delay={0.2} className={styles.mark} />
        <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <p className={styles.lead}>{lead}</p>
      </header>

      <Sheet as="section" aria-label="How it went" className={styles.stats}>
        <Stat
          value={<span className="tabular-nums">{stats.cards}</span>}
          label={stats.cards === 1 ? 'Card reviewed' : 'Cards reviewed'}
          hint={stats.answers > stats.cards ? `${stats.answers} answers` : undefined}
        />
        <Stat
          value={<span className="tabular-nums">{stats.percent}%</span>}
          label="Of the points"
          hint={`${stats.pointsHit} of ${stats.pointsTotal}`}
        />
        <Stat
          value={<span className="tabular-nums">{stats.fullMarks}</span>}
          label="Full marks"
          hint={`of ${stats.answers} ${stats.answers === 1 ? 'answer' : 'answers'}`}
        />
      </Sheet>

      <div className={styles.next}>
        <div className={styles.actions}>
          <AnimatePresence initial={false}>
            {moreDue > 0 ? (
              <motion.div
                key="keep-going"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1, transition: { ...springs.ui, opacity: fades.fast } }}
                exit={{ opacity: 0, transition: fades.fast }}
              >
                <Button variant="primary" size="lg" trailingIcon={<ArrowRight />} loading={keepingGoing} onClick={onKeepGoing}>
                  Keep going
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <ButtonLink to="/" variant={moreDue > 0 ? 'secondary' : 'primary'} size="lg" leadingIcon={<Home />}>
            Back to home
          </ButtonLink>
        </div>
        {comeBack ? <p className={styles.comeBack}>{comeBack}</p> : null}
      </div>

      <section className={styles.list} aria-labelledby="session-cards">
        <h2 id="session-cards" className={styles.listTitle}>
          This session
        </h2>
        <motion.ol className={styles.rows} role="list" variants={staggerVariants(0.04, 0.15)} initial="hidden" animate="visible">
          {rows.map(({ cardId, latest, attempts }, index) => (
            <motion.li key={cardId} variants={index < 8 ? riseVariants : undefined} className={styles.row}>
              <div className={styles.score}>
                <ScoreMark
                  score={latest.review.points_hit}
                  total={latest.review.points_total}
                  seed={latest.review.id}
                  instant
                />
              </div>
              <div className={styles.content}>
                <p className={styles.question}>{latest.card.question}</p>
                <div className={styles.meta}>
                  <p className={styles.metaItems}>
                    <SubjectBadge subject={latest.card.subject} compact className={styles.metaBadge} />
                    <span className={styles.metaItem}>{nextReviewLabel(latest.card.due, now)}</span>
                    {attempts > 1 ? (
                      <span className={cx(styles.metaItem, styles.quiet)}>Answered {attempts} times</span>
                    ) : null}
                    {latest.review.amended_at ? <span className={cx(styles.metaItem, styles.quiet)}>Marks changed</span> : null}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<PencilLine />}
                className={styles.change}
                onClick={() => onChangeMarks(latest.key)}
                aria-label={`Change marks: ${latest.card.question}`}
              >
                Change marks
              </Button>
            </motion.li>
          ))}
        </motion.ol>
      </section>
    </div>
  )
}
