import { ArrowRight } from 'lucide-react'
import { useId } from 'react'
import { ButtonLink, cx, PenTick, Sheet, Stat } from '../../components'
import { formatRelativeDue } from '../../lib/dates'
import styles from './DueHero.module.css'

export interface DueHeroProps {
  /** Cards due now. */
  dueNow: number
  /** Cards that come due later today. */
  dueLaterToday: number
  className?: string
}

/** The home page's main sheet when cards are due: how many, and the way into the review. */
export function DueHero({ dueNow, dueLaterToday, className }: DueHeroProps) {
  const headingId = useId()
  return (
    <Sheet
      as="section"
      margin
      padding="lg"
      elevation="lifted"
      className={cx(styles.hero, className)}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className={styles.eyebrow}>
        Today’s review
      </h2>
      <div className={styles.body}>
        <Stat
          size="lg"
          value={dueNow}
          label={dueNow === 1 ? 'card due' : 'cards due'}
          hint={dueLaterToday > 0 ? `+${dueLaterToday} later today` : undefined}
          className={styles.stat}
        />
        <ButtonLink to="/review" variant="primary" size="lg" trailingIcon={<ArrowRight />} className={styles.start}>
          Start review
        </ButtonLink>
      </div>
    </Sheet>
  )
}

export interface CaughtUpHeroProps {
  /** When the next card comes due (ISO), or null when nothing is scheduled. */
  nextDueAt: string | null
  /** Cards that come due later today (the next one included). */
  dueLaterToday: number
  /** Cards that aren't suspended. */
  activeCards: number
  now: Date
  className?: string
}

/** The main sheet when nothing is due: a tick in the margin and when to come back. */
export function CaughtUpHero({ nextDueAt, dueLaterToday, activeCards, now, className }: CaughtUpHeroProps) {
  const headingId = useId()
  const allSuspended = activeCards === 0

  let message: string
  if (allSuspended) {
    message = 'Every card is suspended. Bring some back from your card list to review them again.'
  } else if (nextDueAt) {
    const when = formatRelativeDue(new Date(nextDueAt), now)
    message = when === 'now' ? 'Your next card is due in a moment.' : `Your next card is due ${when}.`
  } else {
    message = 'Nothing is scheduled yet. Write a card to get started.'
  }

  return (
    <Sheet
      as="section"
      margin
      padding="lg"
      className={cx(styles.hero, styles.caughtUp, className)}
      aria-labelledby={headingId}
    >
      <p className={styles.eyebrow}>Today’s review</p>
      <div className={cx(styles.body, styles.caughtText)}>
        {allSuspended ? null : (
          <span className={styles.marginMark}>
            <PenTick size={32} seed="home-caught-up" delay={0.2} />
          </span>
        )}
        <h2 id={headingId} className={styles.caughtTitle}>
          {allSuspended ? 'Nothing to review' : 'Nothing due right now'}
        </h2>
        <p className={styles.caughtBody}>{message}</p>
        {/* The next card is one of these, so a single one is already covered by the message. */}
        {!allSuspended && dueLaterToday > 1 ? (
          <p className={styles.caughtHint}>{dueLaterToday} cards come due later today</p>
        ) : null}
      </div>
    </Sheet>
  )
}
