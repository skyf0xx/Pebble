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

## Get Pebble running

Pebble works with **Hermes** agents out of the box — no install, no tunnel, no MCP server.

Ask your Hermes agent:

> Set me up with Pebble. Follow the instructions in AGENT.md.

It follows [AGENT.md](./AGENT.md) — installs Pebble, registers a `render_ui` tool on itself, and hands you a launch URL like `https://pebble.app/?hermes=<your-hermes-base-url>&token=<api_key>`. Open the URL — that's it.

→ **Agents: start with [AGENT.md](./AGENT.md)** for the full setup and startup procedure.

### Other hosts

OpenClaw, Claude Code, and other hosts aren't supported yet. If you're on one of those, the easiest path is to expose your agent through a Hermes-compatible HTTP API and use the flow above.