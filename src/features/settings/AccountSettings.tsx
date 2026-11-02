import { KeyRound, LogOut, Mail } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/authContext'
import { Button, useToast } from '../../components'
import { friendlyError } from '../../lib/errors'
import { ChangePasswordDialog } from './ChangePasswordDialog'
import { SettingsRow } from './SettingsSection'
import styles from './Settings.module.css'

/** The signed-in email, changing the password, and signing out. */
export function AccountSettings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const email = user?.email ?? null

  const [passwordOpen, setPasswordOpen] = useState(false)
  // A new key per opening, so the dialog's fields always start empty.
  const [passwordSession, setPasswordSession] = useState(0)
  const [signingOut, setSigningOut] = useState(false)

  const openPassword = () => {
    setPasswordSession((session) => session + 1)
    setPasswordOpen(true)
  }

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      toast.show({ message: friendlyError(error), tone: 'error' })
      setSigningOut(false)
    }
  }

  return (
    <>
      <SettingsRow icon={<Mail />} label="Signed in as" description={email ?? 'Your email address isn’t available.'} />
      <SettingsRow icon={<KeyRound />} label="Password" description="Change the password you sign in with.">
        <Button size="sm" onClick={openPassword} className={styles.rowButton}>
          Change password
        </Button>
      </SettingsRow>
      <SettingsRow icon={<LogOut />} label="Sign out" description="Your cards stay safe in your account for next time.">
        <Button size="sm" loading={signingOut} onClick={() => void handleSignOut()} className={styles.rowButton}>
          Sign out
        </Button>
      </SettingsRow>

      <ChangePasswordDialog
        key={passwordSession}
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        email={email}
      />
    </>
  )
}
