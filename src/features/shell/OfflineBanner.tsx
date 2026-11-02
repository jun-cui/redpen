import { CloudOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
import { useElementSize } from '../../hooks/useElementSize'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { fades, springs } from '../../lib/motion'
import styles from './OfflineBanner.module.css'

/**
 * A quiet strip at the top of the content while the device is offline. It sticks to the top as
 * the page scrolls and takes over the top safe-area padding, so nothing slides under it.
 * While it shows it is also the page's scroll padding, so scrolling something into view (a field
 * with an error, or the review's answer once marked) lands below the strip, not under it.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const region = useRef<HTMLDivElement>(null)
  const size = useElementSize(region)

  const height = online ? 0 : Math.round(size?.height ?? 0)
  useLayoutEffect(() => {
    if (!height) return
    const root = document.documentElement
    root.style.scrollPaddingTop = `${height}px`
    return () => {
      root.style.removeProperty('scroll-padding-top')
    }
  }, [height])

  return (
    <div ref={region} role="status" className={styles.region}>
      <AnimatePresence initial={false}>
        {online ? null : (
          <motion.div
            key="offline"
            className={styles.banner}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, transition: { y: springs.ui, opacity: fades.base } }}
            exit={{ opacity: 0, transition: fades.fast }}
          >
            {/* The icon sits inside the line, so a wrapped message stays centred as one group. */}
            <p className={styles.text}>
              <CloudOff className={styles.icon} aria-hidden="true" />
              You’re offline. Changes won’t save until you reconnect.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
