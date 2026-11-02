import type { ReactNode } from 'react'
import { useDocumentTitle } from '../../hooks'
import { cx, Sheet, Wordmark } from '../../components'
import { hasSecretKey } from '../../lib/env'
import styles from './system.module.css'

const VARIABLES: readonly { name: string; what: ReactNode }[] = [
  {
    name: 'VITE_SUPABASE_URL',
    what: (
      <>
        Your Supabase project URL, like <code className={styles.example}>https://xyzcompany.supabase.co</code>.
      </>
    ),
  },
  {
    name: 'VITE_SUPABASE_PUBLISHABLE_KEY',
    what: (
      <>
        The publishable key, which starts with <code className={styles.example}>sb_publishable_</code> (the legacy
        anon key also works). Never the secret or service_role key.
      </>
    ),
  },
]

/** A secret key in place of the publishable one. Never shows the key itself. */
function SecretKeyNotice() {
  return (
    <>
      <p className={styles.eyebrow}>Setup needed</p>
      <h1 className={styles.setupTitle}>That’s your secret key</h1>
      <p className={styles.lede}>
        Use the publishable key instead, and treat the secret key as compromised: rotate it in Supabase.
      </p>

      <Sheet as="section" padding="md" className={styles.setupSheet} aria-labelledby="setup-steps">
        <h2 id="setup-steps" className={styles.setupHeading}>
          To put it right
        </h2>
        <ol className={styles.steps}>
          <li>
            In the Supabase dashboard, go to Project Settings → API Keys. Create a new secret key and delete the one
            you used. If it was a legacy service_role key (a long one starting <code className={styles.example}>eyJ</code>),
            switch the legacy keys off there instead.
          </li>
          <li>
            Set <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to the publishable key, which starts with{' '}
            <code className={styles.example}>sb_publishable_</code>.
          </li>
          <li>Restart the dev server. The app starts as soon as it has the right key.</li>
        </ol>
      </Sheet>
    </>
  )
}

/** Settings missing from the build. */
function MissingSettingsNotice() {
  return (
    <>
      <p className={styles.eyebrow}>Almost there</p>
      <h1 className={styles.setupTitle}>Redpen isn’t connected to its database yet</h1>
      <p className={styles.lede}>
        This copy of Redpen was built without its Supabase settings, so it can’t sign anyone in. Whoever runs it
        can fix that in a couple of minutes.
      </p>

      <Sheet as="section" padding="md" className={styles.setupSheet} aria-labelledby="setup-steps">
        <h2 id="setup-steps" className={styles.setupHeading}>
          In Cloudflare Pages
        </h2>
        <ol className={styles.steps}>
          <li>Open the Redpen project, then Settings, then Variables and Secrets.</li>
          <li>
            Add these two variables for the Production environment (and Preview, if you use it):
            <dl className={styles.vars}>
              {VARIABLES.map((variable) => (
                <div key={variable.name} className={styles.var}>
                  <dt>
                    <code>{variable.name}</code>
                  </dt>
                  <dd>{variable.what}</dd>
                </div>
              ))}
            </dl>
          </li>
          <li>You’ll find both in the Supabase dashboard: choose <strong>Connect</strong> at the top of your project, or go to Project Settings → API Keys.</li>
          <li>
            Retry the latest deployment. The settings are built into the app, so they only take effect after a new
            build.
          </li>
        </ol>
      </Sheet>

      <p className={styles.footnote}>
        Both values are safe to publish: row-level security keeps everyone’s cards private.
      </p>
    </>
  )
}

/**
 * Shown instead of the app when it can't safely start: a production build made without its
 * Supabase settings, or a secret key where the publishable one belongs (which `vite build`
 * refuses, so only a dev server gets that far). Rendered outside the router, so it uses no links
 * or routing hooks.
 */
export function SetupRequiredPage() {
  useDocumentTitle('Setup needed')
  return (
    <div className={styles.standalone}>
      <header className={cx(styles.standaloneHeader, styles.setupHeader)}>
        <Wordmark />
      </header>
      <main className={styles.setupMain}>{hasSecretKey ? <SecretKeyNotice /> : <MissingSettingsNotice />}</main>
    </div>
  )
}
