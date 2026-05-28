# Pebble WebSocket Protocol — Implementation Reference

Used by Claude Code when implementing `src/lib/ws.ts` and related store slices.

## Connection

URL format: `wss://abc123.trycloudflare.com?...` (passed in via `?ws=` query param on page load)

Connect endpoint: the root WebSocket URL (no path suffix needed from client — agent listens on the tunnel URL).

## Reconnect strategy

```
attempt 1: wait 1s
attempt 2: wait 2s
attempt 3: wait 4s
attempt 4: wait 8s
attempt 5+: wait 30s (max)
```

Use `reconnecting-websocket` with:
```ts
new ReconnectingWebSocket(url, [], {
  minReconnectionDelay: 1000,
  maxReconnectionDelay: 30000,
  reconnectionDelayGrowFactor: 2,
  maxRetries: Infinity,
})
```

## On connect flow

1. Set `wsStatus = "connected"`
2. Send `{ type: "ping" }` immediately
3. Agent will send `session_list` automatically — no need to request it

## Streaming messages

`agent_message` arrives in multiple events with `streaming: true`, then a final event with `streaming: false`.

Assemble in store using `message_id` as key:
```ts
// On each streaming chunk:
upsertMessage(session_id, {
  id: message_id,
  role: "agent",
  content: existing_content + new_content,  // append
  streaming: true,
  timestamp
})

// On streaming: false:
upsertMessage(session_id, { ...message, streaming: false })
```

## agent_push handling

- `session_id !== null` + active session matches → append as a system-style message in the thread
- `session_id !== null` + different session → increment unread on that session card
- `session_id === null` → show as a floating toast (priority: "high" = prominent, "low" = subtle)

## Ping / pong

Send `{ type: "ping" }` every 25 seconds to keep the connection alive through Cloudflare's timeout.

```ts
setInterval(() => send({ type: "ping" }), 25_000)
```

Clear interval on disconnect.

## Error handling

On `{ type: "error" }` from agent:
- Log to console
- If `session_id` is set, show an inline error message in that session's thread
- Do not disconnect — errors are recoverable

## Message dispatch table

| Incoming type | Store action |
|---|---|
| `session_list` | `setSessions(sessions)` |
| `session_history` | `setMessages(session_id, messages)` |
| `agent_message` (streaming) | `upsertMessage(session_id, { streaming: true, ... })` |
| `agent_message` (final) | `upsertMessage(session_id, { streaming: false, ... })` |
| `agent_ui` | `appendMessage(session_id, { type: "ui", spec, ... })` |
| `session_status` | `upsertSession({ session_id, status, label? })` |
| `agent_push` | see push handling above |
| `pong` | no-op (connection confirmed) |
| `error` | log + optional in-thread error message |