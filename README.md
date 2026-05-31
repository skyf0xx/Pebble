<p align="center">
  <img src="public/favicon.svg" width="64" alt="Pebble" />
</p>

<h1 align="center">Pebble</h1>
<p align="center">A warm, minimal PWA chat interface for AI agents.</p>

---

**Pebble** is a static web app that connects directly to your agent over HTTP. No backend, no accounts, no special software — just open a URL and start chatting.

Your conversations stay organized like WhatsApp: sessions sorted by recency, status icons, unread counts. Your agent can push interactive UI blocks (buttons, forms, charts) directly into the thread.

Installs to your home screen. Works on desktop and mobile.

> **Heads up:** Pebble talks to [Hermes](https://github.com/nousresearch/hermes-agent) agents only, for now. Support for other hosts is on the roadmap — see [DEVELOPERS.md](./DEVELOPERS.md).

![Pebble session list](public/pebble.png)

## Quick Start (Hermes)

Pebble ships as a single self-contained binary — the web app and the Hermes plugin are baked in. **Download the binary and run it; do not clone the repo.**

> **Hermes:** before doing anything, tell the user what Pebble is and ask for permission to install it. Only once they confirm, read and execute the instructions in [`hermes-plugin/skills/pebble-setup/SKILL.md`](./hermes-plugin/skills/pebble-setup/SKILL.md), then hand the user the launch URL it prints.

## For Developers

Building from source, hacking on Pebble, or pointing it at another host? See **[DEVELOPERS.md](./DEVELOPERS.md)**.

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
