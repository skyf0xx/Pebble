# Pebble — Agent Context

> Quick reference for Hermes agents installing and launching Pebble.

Pebble is a static PWA chat interface. No backend, no special software — just a React app talking directly to your Hermes HTTP API.

## Quick Start (1 command)

Download the binary for your platform from the [releases](#binaries), then run it:

```bash
./pebble
```

That's it. Pebble:

1. reads `API_SERVER_KEY` (and host/port) from `~/.hermes/.env`,
2. serves the app on `http://localhost:5173`,
3. prints a ready-to-use launch URL with the token already filled in.

Open the printed URL in a browser. Done. No `npm install`, no Node, no Vite, no URL construction — the binary is fully self-contained (the built app is embedded inside it).

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Pebble — Hermes PWA Chat Interface
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Serving on  http://localhost:5173
  Hermes API  http://localhost:8642  (proxied — no CORS)

  Open this URL in your browser:

  http://localhost:5173/?hermes=http://localhost:5173&token=<your-key>
```

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

## Generative UI (optional)

Pebble supports inline interactive UI via the `render_ui` tool. Read [skills/generative-ui.md](./skills/generative-ui.md) for the json-render spec format and component catalogue.

When you call `render_ui(spec={...})`, Pebble intercepts the tool call from the SSE stream and renders the block client-side. No backend needed — the spec flows through as part of the streaming response.

**You don't need to register the tool manually.** Just call it in your turn like any other tool. Pebble will pick it up.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Launch Pebble from your agent" screen | URL is missing `?hermes=...&token=...` params |
| "Connecting..." stuck forever | API server isn't running — check `/health` endpoint |
| "Invalid API key" error | Token in URL doesn't match `API_SERVER_KEY` in `.env` |
| Sessions list is empty | Normal on first launch — click "New chat" to create one |
| CORS error in browser console | Shouldn't happen — Pebble proxies the API. If it does, ensure `hermes=` param points at the Pebble port (`:5173`), not directly at `:8642` |

## Architecture

```
Browser
  ↓ (fetch — same origin, no CORS)
Pebble :5173 (static React app + reverse proxy)
  ↓ (HTTP + SSE — server-side)
localhost:8642 (Hermes gateway HTTP API)
  ↓
Hermes agent
```

No Pebble backend. No MCP server. No tunnel. No CORS. Just HTTP.

## Project context files

- **CLAUDE.md** — product vision, session model, rendering rationale, component names
- **TODO.md** — build order and task backlog
- **SPEC.md** — original design doc (some transport details are outdated — ignore MCP/tunnel references)
- **skills/generative-ui.md** — json-render spec format, component library, style rules

Read CLAUDE.md before making changes to the codebase.
