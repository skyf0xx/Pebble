# Mock Agent — Local Development Reference

For use during Phase 1–3 development when no real agent is available.

## What it provides

`scripts/dev-mock-agent.js` — a minimal Node.js WebSocket server that speaks the Pebble protocol.

Behaviours:
- On client connect: sends `session_list` with 3–4 mock sessions
- On `session_resume`: sends `session_history` with a few mock messages
- On `user_message`: waits 800ms, then streams a mock agent reply in 3 chunks
- On `session_create`: creates a new mock session and sends updated `session_list`
- On `ping`: responds with `pong`
- On `session_delete`: removes from mock list

## Running it

```bash
node scripts/dev-mock-agent.js
# → WS server on ws://localhost:3001
```

Then start Pebble with:
```bash
npm run dev
# Navigate to: http://localhost:5173?ws=ws://localhost:3001
```

## Mock data shape

Use these mock sessions to exercise all status states:

```js
const MOCK_SESSIONS = [
  {
    session_id: "s1",
    label: "Research competitors",
    status: "active",
    last_message: "Looking into Notion AI and Linear...",
    last_updated: new Date().toISOString(),
    unread: 0,
  },
  {
    session_id: "s2",
    label: "Fix deploy script",
    status: "waiting",
    last_message: "Which environment should I target?",
    last_updated: new Date(Date.now() - 300_000).toISOString(),
    unread: 1,
  },
  {
    session_id: "s3",
    label: "Draft Q3 update",
    status: "done",
    last_message: "Here's the draft. Let me know if you'd like changes.",
    last_updated: new Date(Date.now() - 3_600_000).toISOString(),
    unread: 0,
  },
]
```

## Mock streaming reply

```js
async function sendStreamingReply(ws, session_id, content) {
  const message_id = `msg_${Date.now()}`
  const words = content.split(' ')
  const chunkSize = Math.ceil(words.length / 3)

  for (let i = 0; i < 3; i++) {
    await sleep(300)
    const chunk = words.slice(i * chunkSize, (i + 1) * chunkSize).join(' ') + ' '
    ws.send(JSON.stringify({
      type: 'agent_message',
      session_id,
      message_id,
      content: chunk,
      streaming: i < 2,
      timestamp: new Date().toISOString(),
    }))
  }
}
```

## Testing agent_ui

To test generative UI, the mock agent can send a button spec after receiving a user message:

```js
ws.send(JSON.stringify({
  type: 'agent_ui',
  session_id,
  message_id: `ui_${Date.now()}`,
  spec: {
    root: 'actions',
    elements: {
      actions: { type: 'Stack', props: { direction: 'horizontal', gap: 'sm' }, children: ['approve', 'reject'] },
      approve: { type: 'Button', props: { label: 'Approve', variant: 'primary' }, on: { press: 'approve_action' } },
      reject:  { type: 'Button', props: { label: 'Reject', variant: 'outline' }, on: { press: 'reject_action' } },
    }
  },
  timestamp: new Date().toISOString(),
}))
```