# Developers & Other Hosts

You don't need any of this to *run* Pebble — only to hack on it or point it at a different host.

## Building from source

```bash
git clone https://github.com/skyf0xx/Pebble.git
cd Pebble
npm install
npm run relaunch          # Re-builds binary and launches server on http://localhost:5173 - Access it from tailscale 

```

## Passphrase lock (optional)

By default Pebble has no login — on the desktop it's gated by your OS (it only listens on localhost), and over the Tailscale tunnel it's gated by your tailnet. If you share your machine or tailnet and want a second factor, set a passphrase and the launcher will require it before opening:

```bash
PEBBLE_PASSPHRASE='your phrase here' ./pebble
# or: ./pebble --app-passphrase 'your phrase here'
```

Prefer the env var — a flag is visible in `ps` to other local users, who are exactly who the lock is meant to keep out. When set, the launcher rejects every `/api/*` request without a matching `pebble_auth` cookie (HTTP 401); the app shows an unlock screen, and a successful unlock sets an `HttpOnly` cookie the browser remembers (so it's once per device, not every launch). The cookie carries over the tunnel too, so "Open on phone" prompts for the passphrase once on the phone. Leave it unset for the original zero-friction local experience.

Caveat: this stops someone opening a browser to your `localhost:<port>` (or the tunnel) without the phrase. It does **not** stop someone who already controls your OS account — they can read the browser's cookie store or the launcher's environment. That's an OS-login boundary, not Pebble's.

## Other hosts

Today Pebble speaks to Hermes only. The transport lives behind a small adapter layer ([`src/lib/adapters/`](./src/lib/adapters/)), so other hosts — OpenClaw, Claude Code, anything with a streaming HTTP API — are a natural next step rather than a rewrite, and on the roadmap. In the meantime you can point Pebble at another platform by exposing a Hermes-compatible HTTP API.

## Reference

- **[CLAUDE.md](./CLAUDE.md)** — product context, design system, component rules, project structure
- **[TODO.md](./TODO.md)** — build order and task backlog
- **[SPEC.md](./SPEC.md)** — product spec and vision
- **[hermes-plugin/skills/pebble-protocol/SKILL.md](./hermes-plugin/skills/pebble-protocol/SKILL.md)** — the `pebble_send` protocol and json-render component catalogue
