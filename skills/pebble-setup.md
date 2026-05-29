---
name: pebble-setup
description: Complete setup guide for connecting Pebble to a Hermes agent
category: integrations
tags: [pebble, hermes, api-server, pwa, setup]
---

# Pebble Setup for Hermes Agents

Complete setup procedure to get Pebble running and connected to your Hermes instance.

## Prerequisites

- Hermes agent v0.15.1+ (API server feature)
- Node.js 20+
- Pebble repository cloned

## Setup Flow

### 1. Enable Hermes API Server

The API server must be enabled in your Hermes configuration. Add these to `~/.hermes/.env`:

```bash
# Pebble API Server
API_SERVER_ENABLED=true
API_SERVER_PORT=8642
API_SERVER_HOST=127.0.0.1
API_SERVER_KEY=<generate-secure-random-key>
API_SERVER_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Generate a secure key:**
```bash
openssl rand -hex 32
```

**Add to .env:**
```bash
cat >> ~/.hermes/.env << EOF

# Pebble API Server
API_SERVER_ENABLED=true
API_SERVER_PORT=8642
API_SERVER_HOST=127.0.0.1
API_SERVER_KEY=$(openssl rand -hex 32)
API_SERVER_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
EOF
```

### 2. Restart Hermes Gateway

The API server starts with the gateway. Restart to pick up the new config:

```bash
hermes gateway restart
```

**Verify it's running:**
```bash
curl http://localhost:8642/health
# Should return: {"status": "ok", "platform": "hermes-agent"}
```

### 3. Install and Build Pebble

```bash
cd /path/to/pebble
npm install
npm run build
```

### 4. Start Pebble Dev Server

```bash
npm run dev
# Starts on http://localhost:5173
```

### 5. Generate Launch URL

Extract the API key from `.env`:

```bash
API_KEY=$(grep '^API_SERVER_KEY=' ~/.hermes/.env | cut -d'=' -f2)
echo "http://localhost:5173/?hermes=http://localhost:8642&token=$API_KEY"
```

### 6. Open Pebble

**Desktop:**
```bash
open "http://localhost:5173/?hermes=http://localhost:8642&token=$API_KEY"
```

**Mobile (same network):**
1. Get your local IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)
2. Replace `localhost` in both the base URL and hermes parameter
3. Generate QR code and scan with phone

## Verification Checklist

- [ ] `hermes gateway status` shows running
- [ ] `curl http://localhost:8642/health` returns `{"status": "ok"}`
- [ ] `curl -H "Authorization: Bearer $API_KEY" http://localhost:8642/api/sessions` returns session list
- [ ] Pebble dev server running on port 5173
- [ ] Browser opens Pebble and shows session list (or empty state if no sessions)

## Troubleshooting

### "Connecting..." forever

1. Check gateway is running: `hermes gateway status`
2. Check API server responds: `curl http://localhost:8642/health`
3. Verify token matches: `grep API_SERVER_KEY ~/.hermes/.env`
4. Check browser console for CORS or auth errors

### CORS errors in browser console

Add your actual IP to `API_SERVER_CORS_ORIGINS` in `.env`, then restart gateway.

### 401 Unauthorized

Token in URL doesn't match `API_SERVER_KEY` in `.env`. Regenerate the launch URL.

### Port already in use

Something else is using 8642 or 5173. Change ports in `.env` (API server) or `vite.config.ts` (Pebble).

## Production Deployment

For production (not localhost):

1. Use a reverse proxy (nginx, Caddy) with HTTPS
2. Set `API_SERVER_HOST=0.0.0.0` to bind all interfaces
3. Update `API_SERVER_CORS_ORIGINS` to your Pebble domain
4. Use `npm run build && npm run preview` for Pebble
5. Serve the `dist/` folder via a web server
6. Update launch URL to use your public domains

## Security Notes

- `API_SERVER_KEY` gives full access to your agent (terminal, files, tools)
- Keep it secret, rotate it regularly
- Only add trusted origins to `API_SERVER_CORS_ORIGINS`
- For public deployments, use HTTPS and consider additional auth layers

## What This Enables

Once connected, Pebble can:

- Create and manage chat sessions
- Stream agent responses in real-time
- Render generative UI pushed by the agent via `render_ui` tool
- Work as an installable PWA on desktop and mobile
- Persist conversations locally (IndexedDB + localStorage)

## Reference

- [Hermes API Server docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)
- [Pebble AGENT.md](../AGENT.md) - Integration details
- [Generative UI skill](./generative-ui.md) - How to compose UI specs
