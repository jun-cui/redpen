import { motion } from 'motion/react'
import { useState } from 'react'
import { cx, ErrorState, Page, PageHeader, Sheet } from '../../components'
import { useDueSummary, useProfile } from '../../data/hooks'
import { useDocumentTitle } from '../../hooks'
import { friendlyError } from '../../lib/errors'
import { riseVariants } from '../../lib/motion'
import { formatLongDate, greetingWithName, localIsoDate } from './greeting'
import { HomeDashboard } from './HomeDashboard'
import { HomeSkeleton } from './HomeSkeleton'
import { useNow } from './useNow'
import { WelcomeSheet } from './WelcomeSheet'
import styles from './HomePage.module.css'

type HomeView = 'loading' | 'error' | 'welcome' | 'dashboard'

/** Home (/): a quiet greeting, what is due now, and the card box at a glance. */
export function HomePage() {
  useDocumentTitle('Home')
  const now = useNow()
  const summary = useDueSummary()
  const profile = useProfile()

  const data = summary.data
  const view: HomeView = data ? (data.total === 0 ? 'welcome' : 'dashboard') : summary.isError ? 'error' : 'loading'

  // Content that replaces another view (the skeleton, or the welcome sheet once example cards
  // arrive) rises in; content that was ready when the page opened just appears with the page.
  const [firstView] = useState(view)
  const enter = view === firstView ? false : 'hidden'

  return (
    <Page width="wide">
      <PageHeader
        eyebrow={
          <time dateTime={localIsoDate(now)} className={styles.date}>
            {formatLongDate(now)}
          </time>
        }
        title={
          <span className={cx(styles.greeting, !profile.isPending && styles.greetingReady)}>
            {greetingWithName(now, profile.data?.display_name)}
          </span>
        }
      />

      <div className={styles.board}>
        {view === 'loading' ? <HomeSkeleton /> : null}

        {view === 'error' ? (
          <Sheet className={styles.error}>
            <ErrorState
              title="Your cards didn’t load"
              message={friendlyError(summary.error)}
              onRetry={() => void summary.refetch()}
              retrying={summary.isFetching}
            />
          </Sheet>
        ) : null}

        {view === 'welcome' ? (
          <motion.div variants={riseVariants} initial={enter} animate="visible">
            <WelcomeSheet />
          </motion.div>
        ) : null}

        {view === 'dashboard' && data ? <HomeDashboard summary={data} now={now} enter={enter} /> : null}
      </div>
    </Page>
  )
}
