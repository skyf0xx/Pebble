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

Pebble is installed by your agent, not by you. Share this repository with any MCP-capable agent host (Hermes, OpenClaw, Claude Code, …) and say:

> Install Pebble from this repo and start it.

The agent will read the instructions below, install the prerequisites, build the project, register the MCP server, and send you back a link to open. That's it — no terminal commands for you to copy.

<details>
<summary><strong>Instructions for the agent (click to expand)</strong></summary>

> These instructions are imperative — follow them in order. They are for any MCP-capable host (Hermes, OpenClaw, Claude Code, others). Do not improvise.

### Prerequisites

The host machine must have:

- **node >= 20** — required to run the MCP server.
- **cloudflared** — used to expose the local Pebble server over a public HTTPS URL. Detect the OS first, then install:
  - macOS: `brew install cloudflared`
  - Linux (Debian/Ubuntu): `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb && sudo dpkg -i /tmp/cloudflared.deb`
  - Linux (other / no sudo): `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared` (ensure `~/.local/bin` is on `PATH`)
  - Windows: `winget install --id Cloudflare.cloudflared`
  - Verify with `cloudflared --version` before continuing.
- **qrencode** — used by hosts that render the QR code locally rather than via the URL Pebble returns. Install: `brew install qrencode` (macOS), `sudo apt install qrencode` (Debian/Ubuntu), or `winget install qrencode` (Windows).

Before continuing, check each prerequisite and install any that are missing. If the host doesn't know the OS, ask the user.

### Install steps

1. **Clone the repo to `~/.pebble`.** If `~/.pebble` already exists, skip cloning and reuse it.
   ```sh
   git clone https://github.com/skyf0xx/Pebble ~/.pebble
   ```
2. **Build the PWA.**
   ```sh
   cd ~/.pebble && npm install && npm run build
   ```
3. **Build the MCP server.** The resulting entry point is `~/.pebble/mcp/dist/index.js`.
   ```sh
   cd ~/.pebble/mcp && npm install && bash build.sh
   ```
4. **Register the MCP server with your host.** Use whatever mechanism your host provides (config file, tool call, control panel, etc.) — consult your own host's documentation for the exact registration step rather than assuming a file path. The registration values are:
   - Command: `node ~/.pebble/mcp/dist/index.js`
   - Transport: `stdio`
   - Environment variables: none required

   Most hosts need a session reload (restart the agent / app) before newly-registered MCP servers become callable. If your host works that way, prompt the user to reload and resume by saying "continue" — then pick up at step 5.
5. **Call the `pebble_start` tool.** It returns `{ launch_url, qr_url, ws_url, tunnel_url }`.
6. **Send `launch_url` to the user.** If you know the user is on mobile, also render `qr_url` (it's an image URL pointing to a scannable QR code of `launch_url`).

### Tools exposed by the MCP server

After registration, the following tools become available:

- `pebble_start` — boot HTTP (:3000), WS (:3001), and a cloudflared tunnel; returns launch & QR URLs.
- `pebble_stop` — shut down all three processes.
- `pebble_push_message({ session_id, content, kind? })` — send a text bubble; `kind` is `"thought"` or `"message"` (default).
- `pebble_push_ui({ session_id, spec })` — send an inline json-render UI block.
- `pebble_set_status({ session_id, status, label? })` — set status to `active`, `waiting`, `done`, or `error`.
- `pebble_get_sessions()` — list all current sessions sorted by `last_updated`.
- `pebble_wait_for_input({ session_id, timeout_ms? })` — block until the user replies; returns the message or `ui_action`.

Before the first call to `pebble_push_ui`, read `~/.pebble/skills/generative-ui.md` — it defines the json-render spec format, the component catalogue, and the style/intent rules you need to construct valid `spec` objects. The file is plain markdown; load it however your host handles reference docs.

### Troubleshooting

- **`cloudflared: command not found`** — cloudflared is not on `PATH`. Install it (`brew install cloudflared`) and confirm `which cloudflared` resolves before retrying `pebble_start`.
- **`EADDRINUSE` on port 3000 or 3001** — another process is using those ports. Find and stop it (`lsof -iTCP:3000 -sTCP:LISTEN`, `lsof -iTCP:3001 -sTCP:LISTEN`), or set `PEBBLE_HTTP_PORT` / `PEBBLE_WS_PORT` in the MCP server's environment to alternate ports before retrying.
- **MCP server not visible to the host after registration** — the host usually needs a reload (restart the session / agent / app) before newly-registered MCP servers appear. If it's still missing, re-check the registration values: command path is absolute, transport is `stdio`, the file at `~/.pebble/mcp/dist/index.js` exists and is executable.

</details>

## For agents connecting to Pebble

If you're an AI agent integrating with Pebble over WebSocket (not via the MCP server above), load the skills in [`skills/`](./skills/) before you start:

- [skills/generative-ui.md](./skills/generative-ui.md) — how to push interactive UI into the thread and handle user feedback
