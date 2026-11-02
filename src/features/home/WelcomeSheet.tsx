import { Layers, Plus } from 'lucide-react'
import { useId } from 'react'
import { BrandMark, Button, ButtonLink, Sheet, useToast } from '../../components'
import { useAddExampleCards } from '../../data/hooks'
import { friendlyError } from '../../lib/errors'
import { cardCount } from './greeting'
import styles from './WelcomeSheet.module.css'

/** How many example cards add_example_cards() writes (three per subject). */
const EXAMPLE_CARD_COUNT = 12

const STEPS = [
  {
    title: 'Write a card',
    body: 'A question to answer from memory, and the key points a mark scheme would give credit for.',
  },
  {
    title: 'Answer it like an exam',
    body: 'Type your answer in full, the way you would write it on the paper.',
  },
  {
    title: 'Mark it like an examiner',
    body: 'Tick each key point you made, and Redpen works out when you should see the card again.',
  },
] as const

/** The home page for someone with no cards yet: what Redpen does and two ways to begin. */
export function WelcomeSheet() {
  const headingId = useId()
  const toast = useToast()
  const addExamples = useAddExampleCards()

  const add = () => {
    if (addExamples.isPending) return
    addExamples.mutate(undefined, {
      onSuccess: (added) =>
        toast.show({
          message: added > 0 ? `Added ${cardCount(added)} to your box` : 'The example cards are already in your box',
        }),
      onError: (error) => toast.show({ message: friendlyError(error), tone: 'error' }),
    })
  }

  return (
    <Sheet as="section" padding="lg" elevation="lifted" className={styles.welcome} aria-labelledby={headingId}>
      <header className={styles.header}>
        <BrandMark size={40} animated delay={0.25} className={styles.mark} />
        <h2 id={headingId} className={styles.title}>
          Welcome to Redpen
        </h2>
        <p className={styles.lead}>Flashcards you answer in full sentences, marked like an exam paper.</p>
      </header>

      <ol role="list" className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <div className={styles.stepText}>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className={styles.actions}>
        <ButtonLink to="/cards/new" variant="primary" leadingIcon={<Plus />} className={styles.action}>
          Write your first card
        </ButtonLink>
        <Button leadingIcon={<Layers />} loading={addExamples.isPending} onClick={add} className={styles.action}>
          Add {EXAMPLE_CARD_COUNT} example cards
        </Button>
      </div>
      <p className={styles.note}>The examples cover all four subjects. You can edit or delete them at any time.</p>
    </Sheet>
  )
}
