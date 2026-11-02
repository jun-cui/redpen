import { createContext, useContext } from 'react'

/** True inside the app shell (sidebar or tab bar around the page). */
export const ShellContext = createContext(false)

/** Whether the component renders inside the app shell, e.g. to skip its own brand header. */
export function useInShell(): boolean {
  return useContext(ShellContext)
}
