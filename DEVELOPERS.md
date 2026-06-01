# Developers & Other Hosts

You don't need any of this to *run* Pebble — only to hack on it or point it at a different host.

## Building from source

```bash
git clone https://github.com/skyf0xx/Pebble.git
cd Pebble
npm install
npm run relaunch          # Re-builds binary and launches server on http://localhost:5173 - Access it from tailscale 

```

## Other hosts

Today Pebble speaks to Hermes only. The transport lives behind a small adapter layer ([`src/lib/adapters/`](./src/lib/adapters/)), so other hosts — OpenClaw, Claude Code, anything with a streaming HTTP API — are a natural next step rather than a rewrite, and on the roadmap. In the meantime you can point Pebble at another platform by exposing a Hermes-compatible HTTP API.

## Reference

- **[CLAUDE.md](./CLAUDE.md)** — product context, design system, component rules, project structure
- **[TODO.md](./TODO.md)** — build order and task backlog
- **[SPEC.md](./SPEC.md)** — product spec and vision
- **[hermes-plugin/skills/pebble-protocol/SKILL.md](./hermes-plugin/skills/pebble-protocol/SKILL.md)** — the `pebble_send` protocol and json-render component catalogue
