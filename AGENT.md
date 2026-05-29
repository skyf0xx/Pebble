# Pebble — Agent Context

> Quick reference for Hermes agents installing and launching Pebble.

Pebble is a static PWA chat interface. No backend, no special software — just a React app talking directly to your Hermes HTTP API.

## Quick Start (3 commands)

```bash
cd /path/to/pebble
npm install
npm run dev
```

Then construct and open the launch URL:

```bash
API_KEY=$(grep '^API_SERVER_KEY=' ~/.hermes/.env | cut -d'=' -f2)
echo "http://localhost:5173/?hermes=http://localhost:8642&token=$API_KEY"
```

Copy that URL and open it in a browser. Done.

---

## What just happened

1. **npm install** — installed React, Vite, Tailwind, json-render, and other deps
2. **npm run dev** — started Vite dev server on port 5173
3. **URL construction** — pulled your existing `API_SERVER_KEY` from `.hermes/.env` and built the connection string

Pebble connects to `http://localhost:8642` (your Hermes gateway's HTTP API server) using the token for auth. The API server is **already running** — it's enabled by default in modern Hermes installs.

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

## Dev vs. Production

**Development** (what you just did):
```bash
npm run dev  # Vite dev server, hot reload, port 5173
```

**Production** (static build for hosting):
```bash
npm run build    # outputs to dist/
npm run preview  # serve the build on port 4173
```

The production build is a static site — you can deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages, S3, nginx, etc.).

## Mobile access (same network)

To open Pebble on your phone while it's on the same WiFi:

```bash
# Get your local IP
ipconfig getifaddr en0  # macOS
# or
hostname -I | awk '{print $1}'  # Linux

# Replace localhost with your IP in both places:
http://192.168.1.100:5173/?hermes=http://192.168.1.100:8642&token=<key>
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
| CORS error in browser console | Add your Pebble origin to `API_SERVER_CORS_ORIGINS` in `.env` and restart gateway |

## Architecture

```
Browser
  ↓ (fetch)
Pebble (static React app)
  ↓ (HTTP + SSE)
localhost:8642 (Hermes gateway HTTP API)
  ↓
Hermes agent
```

No Pebble backend. No MCP server. No tunnel. Just HTTP.

## Project context files

- **CLAUDE.md** — product vision, session model, rendering rationale, component names
- **TODO.md** — build order and task backlog
- **SPEC.md** — original design doc (some transport details are outdated — ignore MCP/tunnel references)
- **skills/generative-ui.md** — json-render spec format, component library, style rules

Read CLAUDE.md before making changes to the codebase.
