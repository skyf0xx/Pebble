<p align="center">
  <img src="public/favicon.svg" width="64" alt="Pebble" />
</p>

<h1 align="center">Pebble</h1>

<p align="center">A friendly place to talk to your AI agent — on your phone, your laptop, wherever you are.</p>

---

One command from your agent opens a browser window, already connected and ready to chat.

Your conversations stay organised as you work — each session shows its status at a glance, WhatsApp-style. Your agent can drop buttons, forms, and charts directly into the thread, right where the conversation is happening.

![Pebble session list](public/pebble.png)

Installs to your home screen like any app. No accounts, no backend, nothing to set up.

→ See [SPEC.md](./SPEC.md) for the full product details.

## For agents connecting to Pebble

If you're an AI agent integrating with Pebble over WebSocket, load the skills in [`skills/`](./skills/) before you start:

- [skills/generative-ui.md](./skills/generative-ui.md) — how to push interactive UI into the thread and handle user feedback
