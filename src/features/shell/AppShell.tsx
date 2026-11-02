import { useEffect, type MouseEvent } from 'react'
import { useIsDesktop } from '../../hooks'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { AnimatedOutlet } from './AnimatedOutlet'
import { OfflineBanner } from './OfflineBanner'
import { prefetchMainPages } from './pageModules'
import { ShellContext } from './shellContext'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import styles from './AppShell.module.css'

/** Focuses <main> without putting #main in the address (which the router would treat as a navigation). */
function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  document.getElementById('main')?.focus()
}

/**
 * The signed-in app around every page except /review: a sidebar from 1024px, a bottom tab bar
 * below that, and the page itself in <main> with route transitions.
 */
export function AppShell() {
  const isDesktop = useIsDesktop()
  const online = useOnlineStatus()

  useEffect(() => prefetchMainPages(), [])

  return (
    <ShellContext value={true}>
      <div className={styles.shell}>
        <a href="#main" className={styles.skipLink} onClick={skipToContent}>
          Skip to content
        </a>
        {isDesktop ? <Sidebar /> : null}
        <div className={styles.content} data-offline={online ? undefined : ''}>
          <OfflineBanner />
          <main id="main" className={styles.main} tabIndex={-1}>
            <AnimatedOutlet />
          </main>
        </div>
        {isDesktop ? null : <TabBar />}
      </div>
    </ShellContext>
  )
}
