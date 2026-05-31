import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useAppStore } from './store'
import { migrateOwnedSessionIds, loadConnectionConfig } from './lib/storage'
import {
  consumeConnectLink,
  saveAndConnect,
  testConnection,
} from './lib/connection'

migrateOwnedSessionIds()

// The connection is set up once via the SetupScreen wizard and persisted to
// localStorage — there are no ?hermes= URL params anymore. Two ways in on boot:
//
//   1. A saved config (returning device) → prime the store immediately.
//   2. A #connect= deep-link from a scanned "Open on phone" QR → verify it
//      before committing, so a stale/garbled QR drops to the wizard instead of
//      stranding the phone in a broken connecting state. The link is scrubbed
//      from the URL inside consumeConnectLink() regardless.
const saved = loadConnectionConfig()
if (saved) {
  // wsUrl is a non-null marker that flips App.tsx out of the setup state.
  useAppStore.getState().setWsUrl(saved.hermes)
  useAppStore.getState().setConnectionConfig(saved)
} else {
  const linked = consumeConnectLink()
  if (linked) {
    void testConnection(linked.hermes, linked.token).then((result) => {
      if (result.ok) saveAndConnect(linked)
      // On failure we silently fall through to SetupScreen — the user can paste
      // the link manually. (A QR scanned onto a device not yet on the tailnet is
      // the common case, and the wizard explains the Tailscale prerequisite.)
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
