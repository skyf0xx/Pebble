# Pebble MCP server

A local MCP server that lets any MCP-compatible agent host (Claude Code, Hermes, OpenClaw, …) run Pebble end-to-end: it boots the static PWA on `:3000`, the WebSocket server on `:3001`, opens a cloudflared tunnel so a phone can reach it, and exposes seven tools for pushing messages, generative UI, and status updates into live sessions.

## Build

```sh
npm install
bash build.sh
```

Entry point: `dist/index.js` (stdio transport, no env vars required).

## Register with a host

The exact registration step depends on the host. The command is always the same:

```
node /absolute/path/to/pebble/mcp/dist/index.js
```

Once registered, call `pebble_start` — it returns `{ launch_url, qr_url }` you can hand to the user.

## Tools

| Tool | Purpose |
| --- | --- |
| `pebble_start` | Boots HTTP+WS+tunnel; returns launch & QR URLs. |
| `pebble_stop` | Tears the three processes down. |
| `pebble_push_message` | Sends an agent text bubble (thought or message). |
| `pebble_push_ui` | Sends an inline json-render UI block. |
| `pebble_set_status` | Updates session status (`active`/`waiting`/`done`/`error`). |
| `pebble_get_sessions` | Lists current sessions. |
| `pebble_wait_for_input` | Blocks until the user replies in a session. |
