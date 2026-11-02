import { House, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button, ButtonContent, buttonClassName, EmptyState, Page, Wordmark } from '../../components'
import { useDocumentTitle } from '../../hooks'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useInShell } from '../shell/shellContext'
import { NotFoundContent } from './NotFoundPage'
import styles from './system.module.css'

const CHUNK_ERROR =
  /dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css|chunkloaderror/i

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return CHUNK_ERROR.test(`${error.name} ${error.message}`)
}

function reload() {
  window.location.reload()
}

/**
 * The router's error boundary: a page threw while rendering, or its code couldn't be loaded
 * (offline, or a new version replaced the old files). Inside the shell it fills the content
 * area and the navigation stays usable; at the top level it brings its own brand header.
 */
export function RouteErrorPage() {
  const error = useRouteError()
  const inShell = useInShell()
  const online = useOnlineStatus()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  useDocumentTitle(notFound ? 'Page not found' : 'Something went wrong')

  let content: ReactNode
  if (notFound) {
    content = <NotFoundContent />
  } else {
    const chunk = isChunkLoadError(error)
    const title = chunk ? (online ? 'Redpen has been updated' : 'This page isn’t available offline yet') : 'Something went wrong'
    const message = chunk
      ? online
        ? 'A newer version is ready. Reload to carry on where you were.'
        : 'Reconnect to the internet, then reload. Pages you’ve already opened still work.'
      : 'This page ran into a problem it couldn’t recover from. Reloading usually sorts it out. Anything you’d already saved is safe.'

    content = (
      <EmptyState
        className={styles.state}
        illustration="torn"
        title={title}
        actions={
          <>
            <Button variant="primary" leadingIcon={<RotateCcw />} onClick={reload}>
              Reload
            </Button>
            {/* A full page load: the router itself may be what failed. */}
            <a href="/" className={buttonClassName({ variant: 'secondary' })}>
              <ButtonContent leadingIcon={<House />}>Go home</ButtonContent>
            </a>
          </>
        }
      >
        {message}
        {import.meta.env.DEV && !chunk ? <ErrorDetails error={error} /> : null}
      </EmptyState>
    )
  }

  if (inShell) {
    return (
      <Page>
        <h1 className="visually-hidden">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
        {content}
      </Page>
    )
  }

  return (
    <div className={styles.standalone}>
      <header className={styles.standaloneHeader}>
        <Wordmark />
      </header>
      <main className={styles.standaloneMain}>
        <h1 className="visually-hidden">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
        {content}
      </main>
    </div>
  )
}

/** Development only: what actually went wrong. */
function ErrorDetails({ error }: { error: unknown }) {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}\n\n${error.stack ?? ''}`
      : isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : String(error)
  return (
    <details className={styles.details}>
      <summary>Details (development only)</summary>
      <pre>{text}</pre>
    </details>
  )
}
