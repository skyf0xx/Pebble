import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useAppStore } from './store'
import { pickConfig } from './lib/connection'
import { migrateOwnedSessionIds } from './lib/storage'

migrateOwnedSessionIds()

const config = pickConfig(window.location.search)
if (config) {
  // Stash any non-null marker so the App.tsx three-state gate kicks in.
  useAppStore.getState().setWsUrl(config.hermes)
  useAppStore.getState().setConnectionConfig(config)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
