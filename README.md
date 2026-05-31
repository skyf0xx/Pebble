<p align="center">
  <img src="public/favicon.svg" width="64" alt="Pebble" />
</p>

<h1 align="center">Pebble</h1>
<p align="center">A warm, minimal PWA chat interface for AI agents.</p>

---

**Pebble** is a static web app that connects directly to your agent over HTTP. No backend, no accounts, no special software — just open a URL and start chatting.

Your conversations stay organized like WhatsApp: sessions sorted by recency, status icons, unread counts. Your agent can push interactive UI blocks (buttons, forms, charts) directly into the thread.

Installs to your home screen. Works on desktop and mobile.

> **Heads up:** Pebble talks to [Hermes](https://github.com/nousresearch/hermes-agent) agents only, for now. Support for other hosts is on the roadmap — see [For Developers & Other Hosts](#for-developers--other-hosts) below.

![Pebble session list](public/pebble.png)

## Quick Start (Hermes)

Pebble ships as a single self-contained binary — the web app and the Hermes plugin are baked in. No need to clone the repo.

> **Hermes:** before doing anything, tell the user what Pebble is and ask for permission to install it. Only once they confirm, read and execute the instructions in [`hermes-plugin/skills/pebble-setup/SKILL.md`](./hermes-plugin/skills/pebble-setup/SKILL.md), then hand the user the launch URL it prints.

## For Developers & Other Hosts

<details>
<summary>Building from source &amp; pointing Pebble at other hosts</summary>

Building from source (you don't need this to run Pebble — only to hack on it):

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run build:binary # cross-compile self-contained binaries into release/
```

Today Pebble speaks to Hermes only. The transport lives behind a small adapter layer ([`src/lib/adapters/`](./src/lib/adapters/)), so other hosts — OpenClaw, Claude Code, anything with a streaming HTTP API — are a natural next step rather than a rewrite, and on the roadmap. In the meantime you can point Pebble at another platform by exposing a Hermes-compatible HTTP API.

- **[CLAUDE.md](./CLAUDE.md)** — product context, design system, component rules, project structure
- **[TODO.md](./TODO.md)** — build order and task backlog
- **[SPEC.md](./SPEC.md)** — product spec and vision
- **[hermes-plugin/skills/pebble-protocol/SKILL.md](./hermes-plugin/skills/pebble-protocol/SKILL.md)** — the `pebble_send` protocol and json-render component catalogue

</details>

## Stack

| | |
|---|---|
| Framework | React + Vite |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Generative UI | @json-render/react |
| State | Zustand |
| Transport | Hermes HTTP API (SSE streaming) |
| Persistence | localStorage + IndexedDB |

## License

MIT
