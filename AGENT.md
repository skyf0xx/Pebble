# Pebble — Agent Context

> Quick reference for AI agents managing or integrating with Pebble installations.

## Before you install — find permanent storage

Container and sandbox environments often have an ephemeral home directory that is wiped on restart. Installing to `~/.pebble/` in such an environment means the install is lost every session.

**Do this first:**

1. Identify which directories survive a restart. Common permanent locations:
   - A mounted volume (check `df -h` or `mount` for non-tmpfs, non-overlay mounts)
   - A workspace directory your host explicitly persists (e.g. `/workspace`, `/home/user/data`, a path in your host's config)
   - Your host's designated persistent path (check host docs or environment variables like `$PERSISTENT_DIR`, `$DATA_DIR`, `$WORKSPACE`)

2. Pick the best candidate and confirm it persists. If unsure, write a test file, simulate or note the path, and verify it survives between sessions before proceeding.

3. **Save the chosen path to your memory** before installing — e.g. `"Pebble installed at /workspace/.pebble"`. This way future sessions can find it without probing.

4. Install to that path instead of the default. Replace `~/.pebble` with your chosen path throughout these instructions, and set a shell alias or symlink if needed:

   ```sh
   ln -s /your/permanent/path/.pebble ~/.pebble
   ```

   The symlink lets the rest of these instructions work as written.

If your environment genuinely has a persistent home directory, `~/.pebble/` is fine — skip this section.

## Location

```sh
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
- **Transport:** `stdio` (omit this field if your host rejects it — stdio is the default)

Most hosts need a session reload after registration before the MCP server becomes callable.

## Build sequence

Use `--include=dev` for both steps — devDependencies are required at build time:

```sh
cd ~/.pebble && npm install --include=dev && npm run build
cd ~/.pebble/mcp && npm install --include=dev && bash build.sh
```

## After install — create the marker

Once installation is complete, write the marker so future sessions can detect it without probing:

```sh
echo "installed: $(date -Iseconds)" > ~/.pebble/.installed
```

## Invoking tools when MCP doesn't surface them

Some hosts (e.g. OpenClaw) don't expose newly registered MCP tools mid-session. If `pebble_start` isn't available after registration:

1. Reload/restart your host session.
2. Verify the entry point runs cleanly: `node ~/.pebble/mcp/dist/index.js` (it should stay open waiting for stdin).
3. Test the tool list manually by piping JSON to stdin:

   ```sh
   echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node ~/.pebble/mcp/dist/index.js
   ```

4. If tools still don't surface, call `pebble_start` via a wrapper script:

   ```sh
   echo '{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"pebble_start","arguments":{}}}' \
     | node ~/.pebble/mcp/dist/index.js
   ```

## Troubleshooting

- **Port in use (`EADDRINUSE`)** — find and stop the conflicting process (`lsof -iTCP:3000 -sTCP:LISTEN`), or set `PEBBLE_HTTP_PORT` / `PEBBLE_WS_PORT` in the MCP server's environment.
- **`cloudflared: command not found`** — install it and confirm `which cloudflared` resolves before retrying `pebble_start`. See README for OS-specific install commands.
- **MCP server not visible after registration** — check the entry point exists (`test -f ~/.pebble/mcp/dist/index.js`), confirm transport is `stdio`, and reload the host session. See "Invoking tools when MCP doesn't surface them" above.
- **Full install instructions** — see the collapsible agent instructions in [README.md](./README.md).
