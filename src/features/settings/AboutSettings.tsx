import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button, ConfirmDialog, useToast, Wordmark } from '../../components'
import { isDemoMode } from '../../lib/env'
import { friendlyError } from '../../lib/errors'
import { SettingsBlock, SettingsRow } from './SettingsSection'
import styles from './Settings.module.css'

/**
 * Clears the in-browser demo store; it reseeds itself on the next read. The demo module is only
 * reachable in development builds: production drops this branch and the import with it.
 */
async function resetDemoStore(): Promise<void> {
  if (import.meta.env.DEV) {
    const { demoApi } = await import('../../data/demo/demoApi')
    await demoApi.reset()
  }
}

/** What Redpen is and which stage it is at; in demo mode, where the data lives and a reset. */
export function AboutSettings() {
  return (
    <>
      <SettingsBlock className={styles.about}>
        <Wordmark size="md" />
        <p className={styles.aboutLead}>AI-marked flashcards with a mistake log, for A level revision.</p>
        <p className={styles.aboutStage}>Stage 1: self-marked reviews. AI marking arrives in Stage 2.</p>
      </SettingsBlock>
      {isDemoMode ? <DemoDataRow /> : null}
    </>
  )
}

function DemoDataRow() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const reset = async () => {
    try {
      await resetDemoStore()
      // Everything on screen came from the old store: refetch whatever is showing.
      await queryClient.invalidateQueries()
      toast.show({ message: 'Demo data reset' })
    } catch (error) {
      toast.show({ message: friendlyError(error), tone: 'error' })
      throw error
    }
  }

  return (
    <>
      <SettingsRow
        icon={<FlaskConical />}
        label="Demo mode"
        description="Redpen is running without a Supabase project, so your cards, reviews and topics live only in this browser."
      >
        <Button size="sm" leadingIcon={<RotateCcw />} onClick={() => setConfirmOpen(true)} className={styles.rowButton}>
          Reset demo data
        </Button>
      </SettingsRow>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={reset}
        title="Reset demo data?"
        confirmLabel="Reset demo data"
        destructive
      >
        Your demo cards, reviews, topics and name are replaced with a fresh copy of the example cards. This can’t be
        undone.
      </ConfirmDialog>
    </>
  )
}
