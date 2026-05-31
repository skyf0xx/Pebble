---
name: pebble-setup
description: Install, update, launch, and talk to Pebble — the PWA chat interface — from a Hermes agent
category: integrations
tags: [pebble, hermes, api-server, pwa, setup, update]
---

# Pebble for Hermes Agents

Pebble is a static PWA chat interface that talks to your Hermes HTTP API. The
Pebble launcher is a single self-contained binary: the web app and the Hermes
plugin are embedded in it, so there's no clone, no `npm`, no Node. It serves the
app and reverse-proxies `/api/*`, `/v1/*`, and `/health` to Hermes, so the
browser never makes a cross-origin request.

> Prerequisite: a running Hermes API server. Check with
> `curl http://localhost:8642/health` — it should return
> `{"status": "ok", "platform": "hermes-agent"}`. If it doesn't, enable the API
> server in `~/.hermes/.env` and restart the gateway:
>
> ```bash
> grep -q '^API_SERVER_ENABLED=' ~/.hermes/.env || echo "API_SERVER_ENABLED=true" >> ~/.hermes/.env
> grep -q '^API_SERVER_KEY='     ~/.hermes/.env || echo "API_SERVER_KEY=$(openssl rand -hex 32)" >> ~/.hermes/.env
> hermes gateway restart && sleep 3 && curl http://localhost:8642/health
> ```
>
> (If chat turns fail even though `/health` is ok, the agent has no model/tools
> configured yet — run `hermes setup --portal`.)

> **Updating?** Same steps — re-run step 1 (latest binary) then step 2
> (relaunch reinstalls the plugin); `hermes gateway restart` if the plugin
> changed. No config migration. (The `pebble:pebble-update` skill is just a
> pointer back here.)

## 1. Download the binary into permanent storage (once) - ignore if already downloaded

Install it under `~/.hermes/bin/` — next to the agent it serves, and out of any
ephemeral working directory so it survives across sessions. Skip if you already
have it; re-run to update.

```bash
mkdir -p ~/.hermes/bin
# pick your platform: pebble-macos-arm64, -macos-x64, -linux-x64, -linux-arm64, -windows-x64.exe
curl -L https://github.com/skyf0xx/Pebble/releases/latest/download/pebble-macos-arm64 \
  -o ~/.hermes/bin/pebble && chmod +x ~/.hermes/bin/pebble
```

## 2. Start Pebble

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; sleep 1   # free the port first
~/.hermes/bin/pebble
```

It reads `API_SERVER_KEY`/host/port from `~/.hermes/.env`, installs or updates
the Pebble plugin into `~/.hermes/plugins/pebble/`, serves on
`http://localhost:5173`, and prints a launch URL.

**Confirm it's up** (the banner may not show when run in the background):

```bash
curl http://localhost:5173/health   # {"status": "ok", "platform": "hermes-agent"}
```

**If it installed or updated the plugin, restart the gateway** — the agent can't
talk to Pebble until the plugin loads:

```bash
hermes gateway restart
```

## 3. Expose Pebble over Tailscale

Expose the **launcher** (5173), not raw Hermes (8642): the launcher injects the
`API_SERVER_KEY` when proxying to Hermes, so tokenless Pebble connects — hitting
8642 directly gets a 401. With Tailscale running on this machine:

```bash
tailscale serve status 2>/dev/null | grep -q 5173 || tailscale serve --bg 5173
tailscale serve status   # confirm: https://<host>.ts.net → http://127.0.0.1:5173
```

Use `--bg` (a bare `tailscale serve 5173` runs foreground and holds port 443:
`foreground listener already exists for port 443`). The user needs Tailscale on
their phone too, under the same account — the setup wizard walks them through it.

## 4. Share Pebble with the user

Hand the user the URL Pebble printed, or just tell them to open
`http://localhost:5173`. On first launch Pebble walks them through a short setup
wizard (install Tailscale, then paste the agent's `https://<host>.ts.net` URL —
no token); after that it reconnects automatically.

Once Pebble is connected on one device, the **"Open on phone"** button (bottom
of the session list) shows a QR that carries the connection in the URL fragment.
Scanning it on a phone that's already on the tailnet loads Pebble from the
`.ts.net` URL and auto-connects — no re-typing. The token never travels, because
there is none.

## 5. Reply through `pebble_send` only

Once the user is in Pebble, **every reply goes through the `pebble_send` tool** —
Pebble does not read plain-text output, and the `session_id` arg must be the
exact session Pebble opened on (the `pre_llm_call` hook injects it at the top of
every turn — use that, never a placeholder).

The full protocol — the `message`/`ui`/`status`/`push` types, the json-render
component catalogue, button intents, the `ui_action` feedback envelope, and how
to recover `session_id` if the hook context is missing — is the **`pebble:pebble-protocol`**
skill ([../pebble-protocol/SKILL.md](../pebble-protocol/SKILL.md)),
loaded automatically by the plugin. That skill is the single source of truth for
talking to Pebble; this one only gets it installed and running.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Connecting..." stuck forever | API server isn't running — `curl http://localhost:8642/health` (see the prerequisite above to enable it) |
| `.ts.net` URL won't load on the phone | Tailscale not running/signed-in on the phone, or the serve proxy isn't up — `tailscale serve status` on the host (see step 3) |
| `.ts.net` URL times out | Serve proxy is up but the launcher isn't running on this machine — nothing behind `127.0.0.1:5173` (step 2) |
| `.ts.net` URL returns 401 | You exposed raw Hermes (8642) instead of the launcher (5173) — re-do step 3 against 5173 so the token gets injected |
| `foreground listener already exists for port 443` | A bare `tailscale serve` is running in another terminal — kill it, then use `tailscale serve --bg 5173` |
| Replies show "Running pebble_send…" instead of rendering | Client older than plugin — you launched a stale binary; redownload (step 1) |
| Agent replies never reach Pebble (empty turns) | Plugin not loaded — `hermes gateway restart`, then check the startup log |
| `pebble_send` not available as a tool | `pebble` missing from `known_plugin_toolsets` in `~/.hermes/config.yaml` — see below |
| Sessions list empty | Normal on first launch — click "New chat" |

**API server not running** — if `/health` gives connection refused:

```bash
grep API_SERVER_ENABLED ~/.hermes/.env || echo "API_SERVER_ENABLED=true" >> ~/.hermes/.env
hermes gateway restart && sleep 3 && curl http://localhost:8642/health
```

If `API_SERVER_KEY` is missing (Invalid API key on connect):
`echo "API_SERVER_KEY=$(openssl rand -hex 16)" >> ~/.hermes/.env`, then restart
the gateway.

**`pebble_send` not available** — the plugin files install to
`~/.hermes/plugins/pebble/`, but Hermes also needs `pebble` listed under
`known_plugin_toolsets` in `~/.hermes/config.yaml`:

```yaml
known_plugin_toolsets:
  cli:
  - pebble        # ← add this line
```

Restart the gateway, then start a **new** chat — sessions open before the restart
won't pick up the tool.

## Reference

- [Hermes API Server docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)
- [pebble-protocol skill](../pebble-protocol/SKILL.md) — the `pebble_send` protocol and component catalogue
