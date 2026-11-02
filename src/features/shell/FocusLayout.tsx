import { motion } from 'motion/react'
import { useLayoutEffect } from 'react'
import { Outlet } from 'react-router'
import { fades } from '../../lib/motion'
import { scrollWindowTo } from './scrollMemory'
import { TOAST_OFFSET_NO_TABBAR, useToastOffset } from './useToastOffset'
import styles from './FocusLayout.module.css'

/**
 * Full-screen focus mode (/review): no navigation, toasts just above the home indicator.
 * The page fades in as the shell leaves. Opacity only, so the page's own fixed-position parts
 * (an answer bar pinned above the keyboard) are placed against the viewport from the start.
 */
export function FocusLayout() {
  useToastOffset(TOAST_OFFSET_NO_TABBAR)
  // The shell may have been scrolled down; focus mode always starts at the top.
  useLayoutEffect(() => scrollWindowTo(0), [])
  return (
    <motion.div className={styles.focus} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fades.base }}>
      <Outlet />
    </motion.div>
  )
}
