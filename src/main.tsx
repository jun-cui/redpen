// Must be first: takes an email link's result (invite, reset, expired) out of the URL before
// anything, the router above all, can push a history entry.
import './auth/captureAuthRedirect'

import './styles/fonts'
import './styles/tokens.css'
import './styles/base.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initTheme } from './lib/theme'

initTheme()

// Route changes restore scroll themselves, after the outgoing page has animated away.
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'

const container = document.getElementById('root')
if (!container) throw new Error('Redpen: #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
