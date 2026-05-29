# Pebble — Agent Context

> Quick reference for AI agents managing or integrating with Pebble installations.

## Location

```
~/.pebble/
```

## Installation check

```sh
test -f ~/.pebble/.installed && echo "installed" || echo "not installed"
```

If the marker is missing but you suspect Pebble is present, verify the MCP entry point directly:

```sh
test -f ~/.pebble/mcp/dist/index.js && echo "built" || echo "not built"
```

## MCP server

- **Entry point:** `~/.pebble/mcp/dist/index.js`
- **Transport:** `stdio`
- **Environment variables:** none required

### Tools

| Tool | Description |
| --- | --- |
| `pebble_start` | Boot HTTP (:3000), WS (:3001), and a cloudflared tunnel. Returns `{ launch_url, qr_url, ws_url, tunnel_url }`. |
| `pebble_stop` | Shut down all three processes. |
| `pebble_push_message({ session_id, content, kind? })` | Send a text bubble. `kind` is `"thought"` or `"message"` (default). |
| `pebble_push_ui({ session_id, spec })` | Send an inline json-render UI block into the thread. |
| `pebble_set_status({ session_id, status, label? })` | Set session status: `active`, `waiting`, `done`, or `error`. |
| `pebble_get_sessions()` | List all sessions sorted by `last_updated`. |
| `pebble_wait_for_input({ session_id, timeout_ms? })` | Block until the user replies; returns the message or `ui_action`. |

Before the first call to `pebble_push_ui`, load `~/.pebble/skills/generative-ui.md` — it defines the json-render spec format, component catalogue, and style rules.

## Common host config locations

| Host | Config file | Key |
| --- | --- | --- |
| Claude Code | `.claude/settings.json` | `mcpServers` |
| OpenClaw | `~/.openclaw/openclaw.json` | `mcpServers` |
| Hermes | `~/.hermes/config.json` | `mcpServers` |

Registration values for any host:
- **Command:** `node ~/.pebble/mcp/dist/index.js`
- **Transport:** `stdio`

Most hosts need a session reload after registration before the MCP server becomes callable.

## After install — create the marker

Once installation is complete, write the marker so future sessions can detect it without probing:

```sh
echo "installed: $(date -Iseconds)" > ~/.pebble/.installed
```

## Troubleshooting

- **Port in use (`EADDRINUSE`)** — find and stop the conflicting process (`lsof -iTCP:3000 -sTCP:LISTEN`), or set `PEBBLE_HTTP_PORT` / `PEBBLE_WS_PORT` in the MCP server's environment.
- **`cloudflared: command not found`** — install it and confirm `which cloudflared` resolves before retrying `pebble_start`. See README for OS-specific install commands.
- **MCP server not visible after registration** — check the entry point exists (`test -f ~/.pebble/mcp/dist/index.js`), confirm transport is `stdio`, and reload the host session.
- **Full install instructions** — see the collapsible agent instructions in [README.md](./README.md).
