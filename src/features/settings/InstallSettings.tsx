import { Monitor, MonitorDown, Share, Smartphone, SquarePlus } from 'lucide-react'
import { useIsStandalone } from '../../hooks'
import { SettingsRow } from './SettingsSection'
import styles from './Settings.module.css'

/** iPhone, iPod or iPad (iPadOS reports itself as a Mac with a touch screen). */
function isAppleTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function IphoneRow() {
  return (
    <SettingsRow
      icon={<Smartphone />}
      label="On iPhone or iPad"
      description={
        <>
          In Safari, tap <strong>Share</strong>
          <Share className={styles.inlineIcon} aria-hidden="true" /> (in the <strong>⋯</strong> menu on newer iPhones),
          then <strong>Add to Home Screen</strong>
          <SquarePlus className={styles.inlineIcon} aria-hidden="true" />. You may need <strong>View More</strong>.
        </>
      }
    />
  )
}

function DesktopRow() {
  return (
    <SettingsRow
      icon={<Monitor />}
      label="On a computer"
      description={
        <>
          In Chrome or Edge, select the install icon
          <MonitorDown className={styles.inlineIcon} aria-hidden="true" /> in the address bar.
        </>
      }
    />
  )
}

/** How to install Redpen as an app, on iPhone and on a computer. */
export function InstallInstructions() {
  // The device in hand comes first.
  return isAppleTouchDevice() ? (
    <>
      <IphoneRow />
      <DesktopRow />
    </>
  ) : (
    <>
      <DesktopRow />
      <IphoneRow />
    </>
  )
}

/** Whether to offer install instructions: only in a browser tab, not in the installed app. */
export function useShowInstallHint(): boolean {
  return !useIsStandalone()
}
