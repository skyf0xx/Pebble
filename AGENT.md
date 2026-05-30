# Pebble — Agent Context

> What a Hermes agent does to launch Pebble and talk to it.

Pebble is a static PWA chat interface that talks directly to your Hermes HTTP API. The launcher binary serves the app and reverse-proxies `/api/*`, `/v1/*`, and `/health` to Hermes, so the browser never makes a cross-origin request.

## Steps

### 1. Download the binary (once)

Skip if you already have `./pebble` — only redownload to update.

```bash
# pick your platform: pebble-macos-arm64, -macos-x64, -linux-x64, -linux-arm64, -windows-x64.exe
curl -L https://github.com/skyf0xx/Pebble/releases/latest/download/pebble-macos-arm64 -o pebble && chmod +x pebble
```

The app and the Hermes plugin are embedded in the binary — no `npm install`, no Node.

### 2. Start Pebble

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; sleep 1   # free the port first
./pebble
```

It reads `API_SERVER_KEY`/host/port from `~/.hermes/.env`, installs or updates the Pebble plugin into `~/.hermes/plugins/pebble/`, serves on `http://localhost:5173`, and prints a launch URL with the token filled in.

**Confirm it's up** (the banner may not show when run in the background):

```bash
curl http://localhost:5173/health   # {"status": "ok", "platform": "hermes-agent"}
```

**If it installed or updated the plugin, restart the gateway** — the agent can't talk to Pebble until the plugin loads:

```bash
hermes gateway restart
```

### 3. Share the launch URL with the user

Hand them the URL Pebble printed (token already filled in):

```text
http://localhost:5173/?hermes=http://localhost:5173&token=<your-key>
```

The `hermes` param points at the Pebble port (`:5173`), never directly at Hermes (`:8642`).

### 4. Reply through `pebble_send` only

Once the user is in Pebble, **every reply goes through the `pebble_send` tool** — Pebble does not read plain-text output. The `session_id` arg must be the exact session Pebble opened on (**never a placeholder**):

- **Preferred:** the `pre_llm_call` hook injects `session_id` into the structured context block at the top of every turn — use that.
- **Fallback:** the Pebble session is the `api_server` entry with the highest `last_active`; its `id` looks like `api_1780097347_2fa008db`:

  ```bash
  API_KEY=$(grep '^API_SERVER_KEY=' ~/.hermes/.env | cut -d'=' -f2)
  curl -s -H "Authorization: Bearer $API_KEY" http://localhost:8642/api/sessions
  ```

The `type` arg selects what Pebble renders:

| `type` | Renders as |
| --- | --- |
| `message` | A chat bubble (your text reply) |
| `ui` | An interactive json-render block (buttons, forms, tables) |
| `status` | A session-status change (active / waiting / done / error) |
| `push` | A proactive notification not tied to a user turn |

Full protocol — every `type`, the json-render component catalogue, button intents, the `ui_action` feedback envelope, patterns — is in the plugin skill loaded as **`pebble:pebble-protocol`** ([hermes-plugin/skills/pebble-protocol/SKILL.md](./hermes-plugin/skills/pebble-protocol/SKILL.md)).

## See also

- **hermes-plugin/skills/pebble-protocol/SKILL.md** — the `pebble_send` protocol

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Launch Pebble from your agent" screen | URL is missing `?hermes=...&token=...` params |
| "Connecting..." stuck forever | API server isn't running — `curl http://localhost:8642/health` |
| "Invalid API key" | Token in URL doesn't match `API_SERVER_KEY` in `~/.hermes/.env` |
| Replies show "Running pebble_send…" instead of rendering | Client older than plugin — you launched a stale binary; redownload (step 1) |
| Agent replies never reach Pebble (empty turns) | Plugin not loaded — `hermes gateway restart`, then check the startup log |
| `pebble_send` not available as a tool | `pebble` missing from `known_plugin_toolsets` in `~/.hermes/config.yaml` — see below |
| Sessions list empty | Normal on first launch — click "New chat" |

**API server not running** — if `/health` gives connection refused:

```bash
grep API_SERVER_ENABLED ~/.hermes/.env || echo "API_SERVER_ENABLED=true" >> ~/.hermes/.env
hermes gateway restart && sleep 3 && curl http://localhost:8642/health
```

If `API_SERVER_KEY` is missing (Invalid API key on connect): `echo "API_SERVER_KEY=$(openssl rand -hex 16)" >> ~/.hermes/.env`, then restart the gateway.

**`pebble_send` not available** — the plugin files install to `~/.hermes/plugins/pebble/`, but Hermes also needs `pebble` listed under `known_plugin_toolsets` in `~/.hermes/config.yaml`:

```yaml
known_plugin_toolsets:
  cli:
  - pebble        # ← add this line
```

Restart the gateway, then start a **new** chat — sessions open before the restart won't pick up the tool.
