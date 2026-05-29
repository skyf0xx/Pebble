---
name: hermes-server
description: Get a Hermes agent installed, configured, and its API server running so Pebble can connect
category: integrations
tags: [hermes, api-server, setup, prerequisites]
---

# Running a Hermes API Server

Pebble has no backend of its own — it talks directly to a Hermes agent's HTTP API
server over `GET /api/sessions` and `POST /api/sessions/{id}/chat/stream`. Before
Pebble can connect, that API server has to be up.

This doc covers the "I don't have Hermes running yet" path. Once the server is up
and `curl http://localhost:8642/health` returns ok, switch to
[pebble-setup.md](./pebble-setup.md) to wire Pebble to it.

> Reference: [Hermes API Server docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)

## 1. Install Hermes

Follow the Nous Research Hermes install instructions for your platform. Confirm the
CLI is on your path:

```bash
hermes --version
```

## 2. Configure a provider and tools

The API server can't do anything useful until Hermes has a model provider and tool
backends configured. The portal setup wires both:

```bash
hermes setup --portal
```

This gives the agent a model to run and the tools it needs. Skip this and chat turns
will fail even though `/health` looks fine.

## 3. Enable the API server

The API server is configured through environment variables in `~/.hermes/.env`.

**Required:**

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=<generate-secure-random-key>   # bearer token; do NOT leave as change-me-local-dev
```

**Useful for Pebble** (Pebble is a browser app, so it needs CORS):

```bash
API_SERVER_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Optional (defaults shown):**

| Variable | Default | Purpose |
|---|---|---|
| `API_SERVER_PORT` | `8642` | HTTP port |
| `API_SERVER_HOST` | `127.0.0.1` | Bind address |
| `API_SERVER_MODEL_NAME` | profile name | Model id reported on `/v1/models` |

Generate a key and append the block in one go:

```bash
cat >> ~/.hermes/.env << EOF

# Pebble API Server
API_SERVER_ENABLED=true
API_SERVER_KEY=$(openssl rand -hex 32)
API_SERVER_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
EOF
```

## 4. Start the gateway

The API server runs as part of the gateway:

```bash
hermes gateway
```

It binds to `http://127.0.0.1:8642` by default (or whatever `API_SERVER_HOST` /
`API_SERVER_PORT` you set). Leave it running.

> If you change `.env` while the gateway is running, stop it (Ctrl-C) and run
> `hermes gateway` again so the new config is picked up. Some builds expose a
> `hermes gateway restart` subcommand — use it if your install has it.

## 5. Verify

```bash
# Server is alive
curl http://localhost:8642/health
# Expected: {"status": "ok", "platform": "hermes-agent"}

# Auth works and sessions are reachable
API_KEY=$(grep '^API_SERVER_KEY=' ~/.hermes/.env | cut -d'=' -f2)
curl -H "Authorization: Bearer $API_KEY" http://localhost:8642/api/sessions
# Expected: a JSON session list (empty array is fine)
```

If both succeed, the server is ready — continue with [pebble-setup.md](./pebble-setup.md).

## Endpoints Pebble relies on

| Method / Path | Used for |
|---|---|
| `GET /health` | Connection check |
| `GET /api/sessions` | Session inbox (`limit`, `offset`, `source`, `include_children`) |
| `POST /api/sessions` | Create an empty session |
| `GET /api/sessions/{id}/messages` | Load thread history |
| `DELETE /api/sessions/{id}` | Delete a session |
| `POST /api/sessions/{id}/chat/stream` | Run a turn over SSE — emits `assistant.delta`, `tool.started`, `tool.completed`, `run.completed` |

## Troubleshooting

### `connection refused` on `/health`

The gateway isn't running, or `API_SERVER_ENABLED` isn't `true`.

```bash
grep API_SERVER_ENABLED ~/.hermes/.env   # add "API_SERVER_ENABLED=true" if missing
hermes gateway                            # (re)start it
```

### `{"error": {"message": "Invalid API key"}}`

`API_SERVER_KEY` is missing or doesn't match the token you're using. Set one, restart
the gateway, and use that exact value.

### `/health` is ok but chat turns fail

The provider/tool backends aren't configured. Run `hermes setup --portal` (step 2).

### CORS errors when Pebble connects

Add Pebble's origin to `API_SERVER_CORS_ORIGINS`, then restart the gateway.

## Security

`API_SERVER_KEY` grants full access to the agent — its terminal, files, and tools.
Keep it secret, rotate it, and only list trusted origins in
`API_SERVER_CORS_ORIGINS`. For anything beyond localhost, front it with HTTPS via a
reverse proxy.
