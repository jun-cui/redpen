import { motion } from 'motion/react'
import { NavLink } from 'react-router'
import { cx } from '../../components'
import { useKeyboardInset } from '../../hooks'
import { fades, springs } from '../../lib/motion'
import { formatCount, NAV_ITEMS } from './navItems'
import { useDueNowCount } from './useDueNowCount'
import styles from './TabBar.module.css'

/**
 * Phone and tablet navigation (below 1024px): fixed to the bottom above the home indicator.
 * Slides away while the on-screen keyboard is open so it never sits on top of a text box.
 */
export function TabBar() {
  const { open: keyboardOpen } = useKeyboardInset()
  const dueNow = useDueNowCount()

  return (
    <motion.nav
      aria-label="Main"
      className={styles.tabbar}
      initial={false}
      animate={keyboardOpen ? { y: '100%', opacity: 0 } : { y: 0, opacity: 1 }}
      transition={{ y: springs.ui, opacity: fades.fast }}
      inert={keyboardOpen}
    >
      <ul role="list" className={styles.list}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const count = item.showsDueCount && dueNow ? dueNow : 0
          return (
            <li key={item.to} className={styles.item}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => cx(styles.tab, isActive && styles.active)}
              >
                {({ isActive }) => (
                  <>
                    <span className={styles.iconWell}>
                      {isActive ? (
                        <motion.span layoutId="tabbar-active" className={styles.indicator} transition={springs.ui} />
                      ) : null}
                      <Icon className={styles.icon} aria-hidden="true" />
                      {count > 0 ? (
                        <span className={styles.count} aria-hidden="true">
                          {formatCount(count)}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.label}>
                      {item.label}
                      {count > 0 ? <span className="visually-hidden">, {count} due</span> : null}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </motion.nav>
  )
}
