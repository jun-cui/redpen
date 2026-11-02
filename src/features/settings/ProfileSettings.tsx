import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, ErrorState, Select, Skeleton, TextField, useToast } from '../../components'
import { useProfile, useUpdateProfile } from '../../data/hooks'
import { friendlyError } from '../../lib/errors'
import { SettingsBlock } from './SettingsSection'
import styles from './Settings.module.css'

/** Matches the profiles.display_name check constraint. */
const NAME_MAX_LENGTH = 60

/** Desired retention presets, as whole percentages (the option values). */
const STRICTNESS = [
  { percent: 85, label: 'Relaxed' },
  { percent: 90, label: 'Balanced (recommended)' },
  { percent: 95, label: 'Intensive' },
] as const

/** Display name and review strictness, saved to the profile in Supabase (so on every device). */
export function ProfileSettings() {
  const profile = useProfile()

  if (profile.isPending) {
    return (
      <>
        <SettingsBlock>
          <span className={styles.fieldSkeleton} aria-hidden="true">
            <Skeleton width={104} height={14} />
            <Skeleton height={48} radius="sm" />
          </span>
          <span className="visually-hidden" role="status">
            Loading your profile
          </span>
        </SettingsBlock>
        <SettingsBlock>
          <span className={`${styles.fieldSkeleton} ${styles.strictness}`} aria-hidden="true">
            <Skeleton width={136} height={14} />
            <Skeleton height={48} radius="sm" />
            <Skeleton width="80%" height={12} />
          </span>
        </SettingsBlock>
      </>
    )
  }

  if (!profile.data) {
    return (
      <SettingsBlock>
        <ErrorState
          compact
          headingLevel="h3"
          title="Your profile didn’t load"
          message={friendlyError(profile.error)}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
      </SettingsBlock>
    )
  }

  return (
    <>
      <SettingsBlock>
        <DisplayNameForm savedName={profile.data.display_name ?? ''} />
      </SettingsBlock>
      <SettingsBlock>
        <StrictnessSelect retention={profile.data.desired_retention} />
      </SettingsBlock>
    </>
  )
}

function DisplayNameForm({ savedName }: { savedName: string }) {
  const toast = useToast()
  const update = useUpdateProfile()
  const hintId = useId()
  // null until the user types, so a name saved on another device still shows here.
  const [draft, setDraft] = useState<string | null>(null)

  const value = draft ?? savedName
  const trimmed = value.trim()
  const changed = draft !== null && trimmed !== savedName.trim()

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!changed || update.isPending) return
    update.mutate(
      { display_name: trimmed || null },
      {
        onSuccess: () => {
          setDraft(null)
          toast.show({ message: trimmed ? 'Name saved' : 'Name removed' })
        },
        onError: (error) => toast.show({ message: friendlyError(error), tone: 'error' }),
      },
    )
  }

  return (
    <form className={styles.nameForm} onSubmit={save} noValidate>
      <TextField
        label="Display name"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="given-name"
        autoCapitalize="words"
        spellCheck={false}
        placeholder="Your first name"
        aria-describedby={hintId}
        className={styles.nameField}
      />
      <Button
        type="submit"
        loading={update.isPending}
        aria-disabled={!changed || undefined}
        className={styles.nameSave}
      >
        Save
      </Button>
      <p id={hintId} className={styles.hint}>
        Used to greet you on the home page. Leave it blank to go without.
      </p>
    </form>
  )
}

function StrictnessSelect({ retention }: { retention: number }) {
  const toast = useToast()
  const update = useUpdateProfile()

  // Show the choice straight away while it saves; fall back to the saved value if it fails.
  const pending = update.isPending ? update.variables?.desired_retention : undefined
  const percent = Math.round((pending ?? retention) * 100)
  const isPreset = STRICTNESS.some((option) => option.percent === percent)

  const change = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = Number(event.target.value)
    const label = STRICTNESS.find((option) => option.percent === next)?.label.replace(/ \(.*\)$/, '') ?? `${next}%`
    update.mutate(
      { desired_retention: next / 100 },
      {
        onSuccess: () => toast.show({ message: `Review strictness set to ${label}` }),
        onError: (error) => toast.show({ message: friendlyError(error), tone: 'error' }),
      },
    )
  }

  return (
    <Select
      label="Review strictness"
      value={String(percent)}
      onChange={change}
      hint="Aim to remember 85%, 90% or 95% of cards when they come back; higher means more frequent reviews."
      className={styles.strictness}
    >
      {STRICTNESS.map((option) => (
        <option key={option.percent} value={option.percent}>
          {option.label}
        </option>
      ))}
      {isPreset ? null : <option value={percent}>Custom ({percent}%)</option>}
    </Select>
  )
}
