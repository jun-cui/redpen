import { Monitor, Moon, Sun } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, NavLink } from 'react-router'
import { cx, SegmentedControl, Wordmark, type SegmentedOption } from '../../components'
import { springs } from '../../lib/motion'
import { useTheme, type ThemePreference } from '../../lib/theme'
import { useAuth } from '../../auth/authContext'
import { DemoNotice } from './DemoBadge'
import { formatCount, NAV_ITEMS } from './navItems'
import { useDueNowCount } from './useDueNowCount'
import styles from './Sidebar.module.css'

const THEME_OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: <span className="visually-hidden">System</span>, ariaLabel: 'System', icon: <Monitor aria-hidden="true" /> },
  { value: 'light', label: <span className="visually-hidden">Light</span>, ariaLabel: 'Light', icon: <Sun aria-hidden="true" /> },
  { value: 'dark', label: <span className="visually-hidden">Dark</span>, ariaLabel: 'Dark', icon: <Moon aria-hidden="true" /> },
]

/** Desktop navigation (1024px and wider): brand, destinations, then account and theme. */
export function Sidebar() {
  const { user } = useAuth()
  const dueNow = useDueNowCount()
  const { preference, setPreference } = useTheme()

  return (
    <aside className={styles.sidebar}>
      <Link to="/" className={styles.brand} aria-label="Redpen, home">
        <Wordmark />
      </Link>

      <nav aria-label="Main" className={styles.nav}>
        <ul role="list" className={styles.list}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const count = item.showsDueCount && dueNow ? dueNow : 0
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cx(styles.link, isActive && styles.active)}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <motion.span layoutId="sidebar-active" className={styles.indicator} transition={springs.ui} />
                      ) : null}
                      <Icon className={styles.icon} aria-hidden="true" />
                      <span className={styles.label}>{item.label}</span>
                      {count > 0 ? (
                        <span className={styles.count}>
                          <span aria-hidden="true">{formatCount(count)}</span>
                          <span className="visually-hidden">, {count} due</span>
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.footer}>
        <DemoNotice />
        {user?.email ? (
          <p className={styles.account}>
            <span className={styles.accountLabel}>Signed in as</span>
            <span className={styles.email} title={user.email}>
              {user.email}
            </span>
          </p>
        ) : null}
        <SegmentedControl
          label="Theme"
          options={THEME_OPTIONS}
          value={preference}
          onChange={setPreference}
          size="sm"
          fullWidth
        />
      </div>
    </aside>
  )
}
