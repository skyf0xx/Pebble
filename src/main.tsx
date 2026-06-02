import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useAppStore } from './store'
import { loadConnectionConfig } from './lib/storage'
import {
  consumeConnectLink,
  originConnectCandidate,
  saveAndConnect,
  testConnection,
} from './lib/connection'

// The connection is set up once and persisted to localStorage — there are no
// ?hermes= URL params. Three ways in on boot, in priority order:
//
//   1. A saved config (returning device) → prime the store immediately.
//   2. A #connect= deep-link from a scanned "Open on phone" QR → verify it
//      before committing, so a stale/garbled QR drops to the wizard instead of
//      stranding the phone in a broken connecting state. The link is scrubbed
//      from the URL inside consumeConnectLink() regardless.
//   3. Pebble was opened directly from its agent's .ts.net origin (the user
//      clicked the URL `tailscale serve --bg 5173` printed). The launcher serves
//      app + API from that origin, so the origin *is* the agent URL — verify and
//      auto-connect, no paste. Only when not on localhost (dev/desktop).
//
// For (2) and (3) we set wsUrl optimistically so the gate shows ConnectingScreen
// (not a flash of the wizard) while verification runs, and clear it on failure.
const saved = loadConnectionConfig()
if (saved) {
  // wsUrl is a non-null marker that flips App.tsx out of the setup state.
  useAppStore.getState().setWsUrl(saved.hermes)
  useAppStore.getState().setConnectionConfig(saved)
} else {
  const linked = consumeConnectLink()
  const candidate = linked ?? originConnectCandidate()
  if (candidate) {
    useAppStore.getState().setWsUrl(candidate.hermes)
    void testConnection(candidate.hermes).then((result) => {
      if (result.ok) saveAndConnect(candidate)
      // On failure, drop back to the wizard. The user can paste the link/URL
      // manually — e.g. a QR scanned onto a device not yet on the tailnet, the
      // common case the wizard's Tailscale prerequisite covers.
      else useAppStore.getState().setWsUrl(null)
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
