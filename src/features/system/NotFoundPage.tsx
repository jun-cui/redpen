import { House } from 'lucide-react'
import { ButtonLink, EmptyState, Page } from '../../components'
import { useDocumentTitle } from '../../hooks'
import styles from './system.module.css'

/** Unknown addresses inside the app shell. */
export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <Page>
      <h1 className="visually-hidden">Page not found</h1>
      <NotFoundContent />
    </Page>
  )
}

/** The 404 message on its own, for pages that bring their own frame (RouteErrorPage). */
export function NotFoundContent() {
  return (
    <EmptyState
      className={styles.state}
      illustration="torn"
      title="This page isn’t in the pile"
      actions={
        <ButtonLink to="/" variant="primary" leadingIcon={<House />}>
          Go home
        </ButtonLink>
      }
    >
      The link may be out of date, or the page has moved. Your cards are all where you left them.
    </EmptyState>
  )
}
