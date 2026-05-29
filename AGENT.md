# Pebble — Agent Context

> Quick reference for Hermes agents installing and launching Pebble.

Pebble is a static PWA chat interface. No backend, no special software — just a React app talking directly to your Hermes HTTP API.

## Quick Start

If you cloned the repo, the prebuilt binary is already inside it — no download needed:

```bash
# Apple Silicon Mac
./release/pebble-macos-arm64

# Intel Mac
./release/pebble-macos-x64

# Linux x64
./release/pebble-linux-x64
```

There are no published GitHub Releases — the binaries in `release/` are the canonical
build artifacts. Only run `npm run build:binary` if you need to rebuild after code changes.

Before launching, check that port 5173 is free:

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; sleep 1
./release/pebble-macos-arm64
```

On launch, Pebble:

1. reads `API_SERVER_KEY` (and host/port) from `~/.hermes/.env`,
2. installs/updates the **Pebble Hermes plugin** into `~/.hermes/plugins/pebble/` (this is what gives your agent the `pebble_send` tool — see [How Pebble talks to your agent](#how-pebble-talks-to-your-agent)),
3. serves the app on `http://localhost:5173`,
4. prints a ready-to-use launch URL with the token already filled in.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Pebble — Hermes PWA Chat Interface
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Serving on  http://localhost:5173
  Hermes API  http://localhost:8642

  ✓ Hermes plugin installed — restart Hermes gateway to apply:
      hermes gateway restart

  Open this URL in your browser:

  http://localhost:5173/?hermes=http://localhost:5173&token=<your-key>
```

**Readiness check:** The binary may not print its banner visibly when run in the
background. Use this to confirm it's up before opening the URL:

```bash
curl http://localhost:5173/health
# Expected: {"status": "ok", "platform": "hermes-agent"}
```

**If Pebble says the plugin was installed or updated, restart the gateway before
opening the URL** — the agent can't communicate with Pebble until the plugin is
loaded:

```bash
hermes gateway restart
```

Once the plugin is loaded (and on every later launch where it's already up to
date), just open the printed URL in a browser. No `npm install`, no Node, no
Vite, no URL construction — the binary is fully self-contained (the built app
and the plugin are both embedded inside it).

Pebble proxies `/api/*`, `/v1/*`, and `/health` to the Hermes API internally,
so the browser never makes a cross-origin request. The `hermes` param in the
URL always points at the Pebble port itself, not directly at Hermes.

### Options

| Flag | Env | Default | Meaning |
|------|-----|---------|---------|
| `--port <n>` | `PEBBLE_PORT` | `5173` | Port to serve Pebble on |
| `--hermes <url>` | `PEBBLE_HERMES` | from `.env` or `http://localhost:8642` | Hermes API base URL |
| `--token <key>` | `PEBBLE_TOKEN` | from `~/.hermes/.env` | Hermes API key |
| `--open` | `PEBBLE_OPEN=1` | off | Open the launch URL in a browser automatically |
| `--no-discover` | | | Don't read `~/.hermes/.env` |

Flags override env, which overrides values discovered from `~/.hermes/.env`.

### Already running?

Each launcher binds one port (default `5173`). If Pebble is already running and
you start it again, the second one exits with `Port 5173 is already in use`.
Stop the existing one first, then start fresh:

```bash
lsof -ti:5173 | xargs kill   # stop whatever is on the Pebble port
./pebble                     # start again
```

Or just run the new one on a different port: `./pebble --port 5174`.

### Binaries

`npm run build:binary` produces these in `release/`:

| File | Platform |
|------|----------|
| `pebble-macos-arm64` | macOS (Apple Silicon) |
| `pebble-macos-x64` | macOS (Intel) |
| `pebble-linux-x64` | Linux (x64) |
| `pebble-linux-arm64` | Linux (ARM) |
| `pebble-windows-x64.exe` | Windows (x64) |

---

## Pebble connects to Hermes directly

Pebble talks to `http://localhost:8642` (your Hermes gateway's HTTP API server) using the token for auth. The API server is **already running** — it's enabled by default in modern Hermes installs.

## Verifying the API server

If the URL doesn't work, check that the API server is actually running:

```bash
curl http://localhost:8642/health
# Expected: {"status": "ok", "platform": "hermes-agent"}
```

Or check through Pebble itself — the launcher proxies `/health`, so this
validates the whole chain (Pebble proxy → Hermes) in one call:

```bash
curl http://localhost:5173/health
# Same expected response, via the Pebble port
```

If you get "connection refused":

```bash
# Check if API_SERVER_ENABLED is true
grep API_SERVER_ENABLED ~/.hermes/.env

# If missing or false, add/update it:
echo "API_SERVER_ENABLED=true" >> ~/.hermes/.env

# Restart the gateway
hermes gateway restart

# Wait 3 seconds, then verify
sleep 3 && curl http://localhost:8642/health
```

If you get `{"error": {"message": "Invalid API key"}}` when Pebble tries to connect, your `API_SERVER_KEY` is missing:

```bash
# Generate a secure key
openssl rand -hex 16

# Add it to .env (replace YOUR_KEY_HERE with the output above)
echo "API_SERVER_KEY=YOUR_KEY_HERE" >> ~/.hermes/.env

# Restart gateway
hermes gateway restart
```

## Building from source

You only need this if you're hacking on Pebble itself or producing fresh binaries — agents just run the prebuilt binary above.

```bash
npm install          # install deps (React, Vite, Tailwind, json-render, …)
npm run dev          # dev server with hot reload on port 5173
npm run build        # static build → dist/
npm run build:binary # build → dist/, embed it, compile self-contained binaries → release/
```

`build:binary` requires [Go](https://go.dev) and Node. Vite produces `dist/`, which is embedded into the binary via Go's `//go:embed` — so the resulting binaries have no runtime dependency on Go, Node, or anything else. It cross-compiles all five platform targets in one run.

For a single binary for your current platform: `npm run build && go build -o pebble .`

The plain `dist/` is also a static site you can deploy to any static host (Netlify, Vercel, GitHub Pages, S3, nginx, etc.) — but then you'd construct the `?hermes=…&token=…` URL yourself, which is exactly the friction the binary removes.

## Mobile access (same network)

To open Pebble on your phone while it's on the same WiFi:

```bash
# Get your local IP
ipconfig getifaddr en0  # macOS
# or
hostname -I | awk '{print $1}'  # Linux

# Replace localhost with your IP in both places:
http://192.168.1.100:5173/?hermes=http://192.168.1.100:5173&token=<key>
```

Make sure `API_SERVER_HOST` in `.env` is `0.0.0.0` (not `127.0.0.1`) if you want the gateway accessible from other devices. Restart the gateway after changing it.

## Calling pebble_send from within a Pebble session

When you are the agent running inside a Pebble session, `pebble_send` requires the correct `session_id` — the one Pebble opened the chat on. **Do not use a placeholder.**

The session ID is available two ways:

**1. From the Hermes context (preferred)**
The `pre_llm_call` hook injects `session_id` into your context for every turn. It will be present in the structured context block at the top of the conversation. Use that value directly.

**2. Look it up via the API**
If the session ID is not in context, fetch the active session list and pick the most recently active `api_server` source entry:

```bash
API_KEY=$(grep '^API_SERVER_KEY=' ~/.hermes/.env | cut -d'=' -f2)
curl -s -H "Authorization: Bearer $API_KEY" http://localhost:8642/api/sessions
```

The current Pebble session will have `"source": "api_server"` and the highest `last_active` timestamp. Use its `id` field as `session_id`.

Session IDs from Pebble follow the format `api_<unix_timestamp>_<8hex>`, e.g. `api_1780097347_2fa008db`.

---

## How Pebble talks to your agent

Pebble doesn't read your agent's plain text replies. **All communication goes
through one tool: `pebble_send`.** That tool is provided by the Pebble Hermes
plugin, which the launcher installs into `~/.hermes/plugins/pebble/` and which
loads when the gateway (re)starts.

When you call `pebble_send`, Pebble intercepts the tool call from the SSE stream
and renders it client-side. No backend needed — it flows through as part of the
streaming response. The `type` field selects what Pebble shows:

| `type` | Renders as |
|--------|-----------|
| `message` | A chat bubble (your text reply) |
| `ui` | An interactive json-render block (buttons, forms, tables) |
| `status` | A session-status change (active / waiting / done / error) |
| `push` | A proactive notification not tied to a user turn |

**You do not register the tool yourself** — the plugin does it. You just call
`pebble_send` in your turn. **Never write a plain text reply when Pebble is the
active interface; always use `pebble_send`.**

The full protocol — every `type`, the json-render component catalogue, button
intents, the `ui_action` feedback envelope, and common patterns — lives in the
plugin skill, loaded into your context as **`pebble:pebble-protocol`** (source:
[hermes-plugin/skills/pebble-protocol/SKILL.md](./hermes-plugin/skills/pebble-protocol/SKILL.md)).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Launch Pebble from your agent" screen | URL is missing `?hermes=...&token=...` params |
| "Connecting..." stuck forever | API server isn't running — check `/health` endpoint |
| "Invalid API key" error | Token in URL doesn't match `API_SERVER_KEY` in `.env` |
| Replies show as "Running pebble_send…" instead of rendering | The agent is calling `pebble_send` but Pebble's client is older than the plugin — rebuild/redeploy the app, or you launched a stale binary |
| Agent replies never reach Pebble (turns look empty) | Plugin not loaded — restart the gateway (`hermes gateway restart`), then check it appears in the gateway startup log |
| Sessions list is empty | Normal on first launch — click "New chat" to create one |
| CORS error in browser console | Shouldn't happen — Pebble proxies the API. If it does, ensure `hermes=` param points at the Pebble port (`:5173`), not directly at `:8642` |
| `pebble_send` not available as a tool (agent can't call it) | `pebble` is missing from `known_plugin_toolsets` in `~/.hermes/config.yaml` — see below |

### `pebble_send` not available — fixing `known_plugin_toolsets`

The launcher installs the plugin files into `~/.hermes/plugins/pebble/`, but Hermes also requires the plugin to be listed in `known_plugin_toolsets` inside `~/.hermes/config.yaml` before it will expose the tool to agents.

Check the current value:

```bash
grep -A 5 "known_plugin_toolsets" ~/.hermes/config.yaml
```

If `pebble` is not listed, add it:

```yaml
known_plugin_toolsets:
  cli:
  - pebble        # ← add this line
  - spotify       # (other plugins you may already have)
```

Then restart the gateway:

```bash
hermes gateway restart
```

Start a **new** chat session in Pebble after the restart — existing sessions that were open before the restart won't pick up the new tool.

## Architecture

```
Browser
  ↓ (fetch — same origin, no CORS)
Pebble :5173 (static React app + reverse proxy)
  ↓ (HTTP + SSE — server-side)
localhost:8642 (Hermes gateway HTTP API)
  ↓
Hermes agent  ──calls──>  pebble_send tool  (Pebble plugin)
```

The agent's `pebble_send` calls ride back out on the same SSE stream; Pebble
reads them and renders client-side. No Pebble backend. No MCP server. No tunnel.
No CORS. Just HTTP.

## Project context files

- **CLAUDE.md** — product vision, session model, rendering rationale, component names
- **TODO.md** — build order and task backlog
- **SPEC.md** — original design doc (some transport details are outdated — ignore MCP/tunnel references)
- **hermes-plugin/skills/pebble-protocol/SKILL.md** — the `pebble_send` protocol: message types, json-render component catalogue, button intents, `ui_action` feedback, patterns

Read CLAUDE.md before making changes to the codebase.
