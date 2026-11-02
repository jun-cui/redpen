import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePreference } from '../../lib/theme'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl/SegmentedControl'

const OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'System', icon: <Monitor aria-hidden="true" /> },
  { value: 'light', label: 'Light', icon: <Sun aria-hidden="true" /> },
  { value: 'dark', label: 'Dark', icon: <Moon aria-hidden="true" /> },
]

export interface ThemeSwitchProps {
  size?: 'sm' | 'md'
  fullWidth?: boolean
  className?: string
}

/** System / Light / Dark, saved on this device. */
export function ThemeSwitch({ size = 'md', fullWidth = false, className }: ThemeSwitchProps) {
  const { preference, setPreference } = useTheme()
  return (
    <SegmentedControl
      label="Theme"
      options={OPTIONS}
      value={preference}
      onChange={setPreference}
      size={size}
      fullWidth={fullWidth}
      className={className}
    />
  )
}
