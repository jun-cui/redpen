import { useEffect } from 'react'

const APP_NAME = 'Redpen'

/** Sets the tab title to "<title> · Redpen" (or just "Redpen") while the component is mounted. */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
