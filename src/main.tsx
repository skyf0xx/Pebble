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
//   3. The origin Pebble loaded from — the launcher serves app + API from the
//      same origin, so it *is* the agent URL. This is now the default everywhere:
//      `http://localhost:<port>` on the desktop machine (no wizard needed to use
//      Pebble locally) and `https://<host>.ts.net` when reached over the tunnel.
//      Verify and auto-connect, no paste.
//
// For (2) and (3) we set wsUrl optimistically so the gate shows ConnectingScreen
// (not a flash of the wizard) while verification runs, and clear it on failure.
// A localhost verify only fails when the Go launcher isn't actually proxying
// (e.g. bare `vite` dev) — that drops to SetupScreen, which is also reachable
// on demand from the app's "Open on phone" button.
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
      // 401 = the launcher's passphrase gate. The origin is reachable; we just
      // need to unlock it. Keep wsUrl set (so we don't flash the wizard) and
      // flag authRequired so App.tsx shows the PassphraseScreen. After a
      // successful login the app re-verifies and connects with the same
      // candidate.
      else if (result.authRequired) useAppStore.getState().setAuthRequired(true)
      // On other failures, drop to SetupScreen. The common real-world case is a
      // QR scanned onto a phone not yet on the tailnet — the wizard's Tailscale
      // steps cover exactly that. (On the desktop this only fires when the Go
      // launcher isn't proxying, which the wizard's "Open your agent" step
      // addresses too.)
      else useAppStore.getState().setWsUrl(null)
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
