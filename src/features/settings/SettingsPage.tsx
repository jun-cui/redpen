import { ListTree, Palette } from 'lucide-react'
import { Page, PageHeader, ThemeSwitch } from '../../components'
import { useDocumentTitle } from '../../hooks'
import { AboutSettings } from './AboutSettings'
import { AccountSettings } from './AccountSettings'
import { InstallInstructions, useShowInstallHint } from './InstallSettings'
import { ProfileSettings } from './ProfileSettings'
import { SettingsLinkRow, SettingsRow, SettingsSection } from './SettingsSection'
import styles from './Settings.module.css'

/** Settings (/settings): appearance, profile, study, account, install and about. */
export function SettingsPage() {
  useDocumentTitle('Settings')
  const showInstall = useShowInstallHint()

  return (
    <Page width="wide">
      <PageHeader title="Settings" />
      <div className={styles.sections}>
        <SettingsSection id="appearance" title="Appearance" description="How Redpen looks on this device.">
          <SettingsRow
            icon={<Palette />}
            label="Theme"
            description="Follow your device, or keep Redpen light or dark."
            wideControl
          >
            <ThemeSwitch size="sm" className={styles.themeSwitch} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection id="profile" title="Profile" description="Your name, and how often cards come back.">
          <ProfileSettings />
        </SettingsSection>

        <SettingsSection id="study" title="Study" description="What your cards are filed under.">
          <SettingsLinkRow
            to="/settings/topics"
            icon={<ListTree />}
            label="Topics"
            description="Edit the topic list for each subject"
          />
        </SettingsSection>

        <SettingsSection id="account" title="Account" description="Signing in and out.">
          <AccountSettings />
        </SettingsSection>

        {showInstall ? (
          <SettingsSection id="install" title="Install" description="Use Redpen like an app: full screen, one tap away.">
            <InstallInstructions />
          </SettingsSection>
        ) : null}

        <SettingsSection id="about" title="About">
          <AboutSettings />
        </SettingsSection>
      </div>
    </Page>
  )
}
