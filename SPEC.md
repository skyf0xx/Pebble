# Pebble

**A small thing in your pocket that quietly gets big things done.**

---

## What is Pebble

AI agents like Claw and Hermes are powerful — but today, talking to them means setting up Telegram bots, Slack integrations, or terminal interfaces that weren't designed for human conversation. These are tools built for developers, not for people who just want to get something done.

Pebble is the missing piece.

It's a lightweight, installable chat interface that your agent sets up *for you*. You don't configure anything. You don't install anything. You just tell your agent — *"Set up Pebble"* — and a browser window opens, already connected, ready to talk.

From then on, every conversation is a **session** — a task you gave your agent. Sessions stack up as you work, show their status at a glance, and get swept away when done. The agent isn't just responding in text — it can push buttons, forms, charts, and interactive UI directly into the conversation, so you tap instead of type.

Pebble works on your desktop browser and your phone. It feels like a native app. It costs nothing to run.

---

## Why Pebble Exists

### The problem with current agent interfaces

Most AI agent UIs are one of three things:

1. **Terminal / CLI** — powerful but inaccessible. Requires technical comfort. Not appropriate for daily task management.
2. **Telegram / Slack bots** — human-designed messaging apps bolted onto agents. Complex to set up, not built for task lifecycle, cluttered with features the agent doesn't need.
3. **Web dashboards** — require hosting, accounts, maintenance. Heavy for what is essentially a chat window.

None of these were designed for the specific experience of *talking to an agent to get something done*.

### Where Pebble comes in

The agent already knows what it wants to say. It already knows what inputs it needs from you. So why should a human designer pre-build every possible UI? 

**Let the agent design the interaction on the fly.**

Pebble gives the agent a component catalog — buttons, forms, charts, tables — and the agent decides when to use them and how to compose them. A task that needs a decision gets a button group. A task that returns data gets a table. A background job that finished pushes a notification. The interface adapts to the task, not the other way around.

### How pebble is different

Most AI products look dark, powerful, and slightly intimidating — glowing interfaces that imply something vast and unknowable is running beneath them.

Pebble is the opposite. Assistants are **friendly**. They're on your side. They're like the helpful sprite in a fantasy story — quick, capable, unassuming, always there when you need them.

Pebble should feel like something warm and smooth in your hand. A pebble dropped in water — you send a small message, and the ripples do the work.

---

## How It Works

### The full flow

```
1. User tells agent: "Set up Pebble"

2. Agent runs the Pebble bootstrap skill:
   - Downloads Pebble (one time only)
   - Installs dependencies
   - Builds the static PWA
   - Starts a local HTTP server (serves the UI)
   - Starts a WebSocket server (handles messages)
   - Runs a Cloudflare tunnel (gets a public HTTPS URL)
   - Generates a QR code

3. On desktop: browser opens automatically, already connected
   On mobile: user scans QR code → Pebble loads → connected instantly

4. User can "Add to Home Screen" → Pebble behaves like a native app

5. User starts tasks as sessions
   Agent responds in text and/or interactive UI
   Sessions show status: active / waiting / done

6. Done sessions get closed. New ones get opened.
   The session list is the agent's task board.
```

### Where everything lives

```
┌─────────────────────────────────────────────────────┐
│  User's Device (browser or home screen PWA)         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Pebble PWA (static bundle)                 │   │
│  │  - Session list (glanceable task board)     │   │
│  │  - Chat thread (messages + agent UI)        │   │
│  │  - WebSocket client                         │   │
│  └──────────────────┬──────────────────────────┘   │
└─────────────────────┼───────────────────────────────┘
                      │ wss:// (Cloudflare Tunnel)
                      │
┌─────────────────────┼───────────────────────────────┐
│  Agent Machine      │  (local or remote, same code) │
│                     │                               │
│  ┌──────────────────┴──────────────────────────┐   │
│  │  Cloudflare Tunnel (free, auto TLS)         │   │
│  │    ↕                                        │   │
│  │  WebSocket Server :3001                     │   │
│  │  HTTP Server :3000  (serves Pebble files)   │   │
│  │  Agent Runtime (Claw / Hermes / compatible) │   │
│  │  Session Manager                            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**The agent machine can be anywhere:**
- Your laptop
- A Raspberry Pi on your desk
- A VPS or cloud server
- A friend's machine

It doesn't matter. Cloudflare Tunnel gives it a public HTTPS URL automatically, with no port forwarding, no certificates, no configuration. The Pebble client connects to that URL and works identically in all cases.

---

## Cloudflare Tunnel

Previously, running an agent on localhost and accessing it from a mobile device required either:
- A VPS with a public IP
- Manual TLS certificates
- Port forwarding on your router
- ngrok (paid for persistent URLs)

Cloudflare Tunnel eliminates all of this. It's free, it's one command, and it gives you a persistent `https://` and `wss://` URL that works everywhere.

```bash
cloudflared tunnel --url http://localhost:3000
# → https://abc123.trycloudflare.com  (instant, free, TLS included)
```

Pebble's bootstrap skill runs this automatically. The agent captures the URL, builds the connection string, and either opens the browser or generates a QR code. The user never touches it.

**Note:** Free Cloudflare tunnels get a new random URL each launch. For MVP this is fine — the agent regenerates and resends the QR on each start. A persistent vanity URL (e.g. `pebble.yourdomain.com`) is available if the user has a Cloudflare account and a domain — a natural upgrade path post-MVP.

---

## The Agent Designs the Interaction

Pebble uses **json-render** (Vercel Labs) to let the agent push interactive UI directly into the conversation thread.

Instead of the agent saying:
> *"Please reply with either 'approve' or 'reject'"*

It pushes:
```
[ Approve ]  [ Reject ]
```

Instead of:
> *"Here are the results: revenue was $12,400, up 8% from last month..."*

It pushes a live metric card with a sparkline.

### How it works

The agent emits a JSON spec describing what to render:

```json
{
  "root": "actions",
  "elements": {
    "actions": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "children": ["approve", "reject"]
    },
    "approve": {
      "type": "Button",
      "props": { "label": "Approve", "variant": "primary" },
      "on": { "press": "approve_action" }
    },
    "reject": {
      "type": "Button",
      "props": { "label": "Reject", "variant": "outline" },
      "on": { "press": "reject_action" }
    }
  }
}
```

Pebble renders it inline. User taps "Approve". Pebble fires a `ui_action` event back over WebSocket. The agent receives it and continues.

### Why this matters

- User taps instead of types — faster, less friction, less error
- Agent can display information richly — tables, charts, progress bars
- Future: voice input + visual output — the agent speaks, you tap
- The interface adapts to each task — no one-size-fits-all UI

### MVP Component Catalog

| Category | Components |
|---|---|
| Layout | Stack, Grid, Card, Separator |
| Text | Heading, Text, Badge, Metric, Icon |
| Actions | Button, ButtonGroup, DropdownMenu |
| Input | Input, Textarea, Select, Radio, Checkbox, Switch, Slider |
| Display | Table, LineGraph, BarGraph, Progress, Alert |
| Overlay | Dialog, Drawer |

The agent composes freely from this catalog. The catalog can be extended at any time.

---

## Sessions — The Chat Inbox

Every conversation is a session. The session list is a **chat inbox**, not a task board — the same mental model as WhatsApp. Each row is a conversation thread; the agent is your contact.

Sessions are sorted by `last_updated`, most recent first — just like a messaging app. There is no grouping by status, no kanban, no columns.

### Session lifecycle

```
NEW
  User taps "+" or agent opens one automatically
  Agent names it from context: "Research competitors", "Fix deploy script"

ACTIVE
  Agent is working. Messages flowing.

WAITING
  Agent needs input — ball is in the user's court.

DONE
  Agent sends session_status { status: "done" }
  Conversation is over. Drifts down as newer sessions arrive above it.

DELETED
  User swipes to delete → gone immediately from list and agent memory.
  No archive, no undo.
```

### Status icons (not pills)

Status is shown via a small icon in the session row, in the same position as WhatsApp's delivery ticks — next to the timestamp, right-aligned. No labels, no colour pills.

| Status | Icon | Notes |
| --- | --- | --- |
| `active` | Animated typing indicator (three dots) | Agent is "typing" — shown in last-message preview area |
| `waiting` | Single tick / clock icon | Delivered, waiting on agent to act |
| `done` | Double tick (terracotta) | Echoes WhatsApp's blue ticks — conversation complete |
| `error` | Single tick (muted red) | Something went wrong |

**Rule:** the status icon reflects the agent's state, not message delivery. When the user sent the last message, the `waiting` clock appears (agent hasn't replied yet). When the agent sent the last message, the icon reflects whether the agent is still working (`active`) or finished (`done`).

### Session row layout

```
┌────────────────────────────────────────────────────┐
│  [thumb]   Fix deploy script            10:42  ✓✓  │
│            "Done. Pushed to main and..."            │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  [thumb]   Research competitors          now  ···  │  ← active (typing dots)
│            "Looking into Notion's pricing..."       │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  [thumb]   Draft investor email          2m   🕐   │  ← waiting on user
│            "Which tone do you prefer?"      [3]    │  ← unread badge
└────────────────────────────────────────────────────┘
```

Each session gets a unique avatar generated by [DiceBear Thumbs](https://www.dicebear.com/styles/thumbs/) — seeded by `session_id`. The avatar is deterministic: the same session always shows the same friendly face. No names, no initials — just a little character that makes each task feel distinct.

```
Avatar URL pattern:
https://api.dicebear.com/9.x/thumbs/svg?seed={session_id}
```

The avatar is rendered as a circular `<img>` (40×40px). No fallback needed — DiceBear always returns a valid SVG for any seed.

Multiple sessions can run simultaneously against the same agent — research in one, a draft in another, a background job in a third.

---

## Responsive Layout

Pebble is a single codebase that adapts to any screen.

```
MOBILE (< 768px)
─────────────────
┌─────────────┐     ┌─────────────┐
│ Sessions    │ →   │ Thread      │
│             │ tap │             │
│ ● Research  │     │ [messages]  │
│ ◐ Draft     │     │             │
│ ✓ Deploy    │     │ [agent UI]  │
│             │     │             │
│      [+]    │     │  [input ▶]  │
└─────────────┘     └─────────────┘
Full screen list    Full screen thread
Back button returns to list

DESKTOP (≥ 768px)
──────────────────
┌──────────┬──────────────────────────┐
│ Sessions │ Thread                   │
│          │                          │
│ ● Resear │ [messages]               │
│ ◐ Draft  │                          │
│ ✓ Deploy │ [agent UI inline]        │
│          │                          │
│    [+]   │ [input bar            ▶] │
└──────────┴──────────────────────────┘
Sidebar + thread side by side
```

**Desktop bonus:** QR code panel — when a new tunnel URL is generated, desktop shows a scannable QR so the user can instantly open Pebble on their phone.

Since Pebble is a PWA:
- Mobile: "Add to Home Screen" → full screen, no browser chrome, feels native
- Desktop: installable as a desktop app from Chrome/Edge
- No App Store, no review process, no distribution friction

---

## Thoughts vs Messages

Agents like Claw are verbose — they narrate their reasoning, tool calls, and intermediate steps as they work. Most of this is noise to the end user. Pebble separates the stream into two kinds:

- **`thought`** — the agent's internal process: "Searching for X...", "Found 3 results, filtering...", tool invocations, reasoning steps. Useful if you're debugging, irrelevant if you just want the answer.
- **`message`** — the final output: the answer, the summary, the decision. This is what the user actually needs.

Both arrive on the same `agent_message` event, distinguished by `kind`.

### How the client renders them

```
While thoughts are streaming:
┌─────────────────────────────────────┐
│  ● thinking...                      │  ← collapsed, subtle, animated
└─────────────────────────────────────┘

When the first "message" chunk arrives, thoughts collapse:
┌─────────────────────────────────────┐
│  ▸ Show thinking  (3 steps)         │  ← expandable if curious
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Here's what I found: ...           │  ← full bubble, solid rendering
└─────────────────────────────────────┘
```

**Thoughts:**
- Collapsed by default into a single "thinking..." indicator while streaming
- On completion, become a small expandable disclosure row ("Show thinking · N steps")
- Dimmed, smaller font weight — present but not demanding attention
- Client may choose to suppress them entirely (a future setting)

**Messages:**
- Rendered as full bubbles, same as today
- Stream in chunk by chunk, final state is solid

A single agent turn can have multiple thought chunks followed by one or more message chunks — all share the same `message_id` so they group together in the thread.

---

## WebSocket Protocol

All communication between Pebble and the agent happens over a single WebSocket connection. The protocol is agent-agnostic — any agent that implements it works with Pebble.

### Client → Agent

```ts
{ type: "session_resume",  session_id: string }
{ type: "session_create",  label?: string }
{ type: "session_delete",  session_id: string }

{
  type: "user_message",
  session_id: string,
  content: string,
  timestamp: ISO8601
}

// User tapped a button or submitted a form in agent UI
{
  type: "ui_action",
  session_id: string,
  action: string,
  payload: Record<string, any>,
  timestamp: ISO8601
}

{ type: "ping" }
```

### Agent → Client

```ts
// Sent immediately on connect — full session list
{ type: "session_list", sessions: SessionMeta[] }

// Full history after session_resume
{ type: "session_history", session_id: string, messages: Message[] }

// Streaming text response (arrives in chunks)
{
  type: "agent_message",
  session_id: string,
  message_id: string,
  content: string,
  kind: "thought" | "message",  // "thought" = reasoning/tool chatter; "message" = final output
  streaming: boolean,            // false = final chunk
  timestamp: ISO8601
}

// Inline interactive UI
{
  type: "agent_ui",
  session_id: string,
  message_id: string,
  spec: JsonRenderSpec,
  timestamp: ISO8601
}

// Session state change
{
  type: "session_status",
  session_id: string,
  status: "active" | "waiting" | "done" | "error",
  label?: string         // agent can name or rename the session
}

// Proactive push — heartbeat result, background task done, alert
{
  type: "agent_push",
  session_id: string | null,   // null = not tied to a session
  content?: string,
  spec?: JsonRenderSpec,
  priority: "low" | "normal" | "high"
}

{ type: "pong" }
{ type: "error", code: string, message: string, session_id?: string }
```

### SessionMeta shape

```ts
{
  session_id: string,
  label: string,
  status: "active" | "waiting" | "done" | "error",
  last_message: string,    // preview for session list
  last_updated: ISO8601,
  unread: number
}
```

**Reconnection:** Pebble auto-reconnects with exponential backoff (1s → 2s → 4s → 8s → max 30s). On reconnect, re-requests session_list and resumes the active session if one was open.

---

## Bootstrap Skill

The agent skill that installs and launches Pebble. Compatible with Claw, Hermes, and any agent that can run shell commands.

```bash
#!/bin/bash
# pebble — bootstrap skill
# Compatible with: Claw, Hermes, any shell-capable agent

INSTALL_DIR="$HOME/.pebble"
PWA_PORT=3000
WS_PORT=3001

# ── Install (first time only) ──────────────────────────────────────────
if [ ! -d "$INSTALL_DIR" ]; then
  echo "🪨 Installing Pebble..."
  git clone https://github.com/pebble-chat/pebble "$INSTALL_DIR"
  cd "$INSTALL_DIR" && npm install && npm run build
  echo "✓ Pebble installed"
fi

cd "$INSTALL_DIR"

# ── Launch servers ─────────────────────────────────────────────────────
npx serve ./dist -l $PWA_PORT --no-clipboard &
HTTP_PID=$!

# Agent starts its own WS server — example commands:
# claw ws-server --port $WS_PORT &
# hermes serve --ws-port $WS_PORT &

# ── Cloudflare Tunnel ──────────────────────────────────────────────────
# Install cloudflared if not present
if ! command -v cloudflared &> /dev/null; then
  echo "Installing cloudflared..."
  # macOS:  brew install cloudflared
  # Linux:  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
fi

# Start tunnel, capture URL
TUNNEL_URL=$(cloudflared tunnel --url http://localhost:$PWA_PORT 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com')
WS_URL=$(echo $TUNNEL_URL | sed 's/https/wss/')

LAUNCH_URL="$TUNNEL_URL?ws=$WS_URL"

# ── Open / share ───────────────────────────────────────────────────────
echo ""
echo "🪨 Pebble is running"
echo "   Desktop: $LAUNCH_URL"
echo "   Mobile:  scan the QR code below"
echo ""

# Generate QR code for mobile
qrencode -t ansiutf8 "$LAUNCH_URL" 2>/dev/null || echo "(install qrencode for QR code)"

# Open desktop browser
open "$LAUNCH_URL" 2>/dev/null || xdg-open "$LAUNCH_URL" 2>/dev/null || true
```

**On subsequent launches:** the install block is skipped. Startup is fast.

**Update command:**
```bash
cd ~/.pebble && git pull && npm run build
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React + Vite | Static output, fast builds, no server needed |
| PWA | vite-plugin-pwa | Installable, works offline, home screen |
| Styling | Tailwind CSS | Utility-first, no runtime overhead |
| Components | shadcn/ui | Accessible, unstyled base, matches json-render |
| Generative UI | @json-render/react | Agent pushes UI specs over WS, 41 components |
| State | Zustand | Minimal, no boilerplate |
| WebSocket | reconnecting-websocket | Auto-reconnect wrapper over native WS |
| Cache | localStorage + IndexedDB | Session list + message history, no backend |
| Icons | Lucide React | Consistent with shadcn + json-render |
| Avatars | DiceBear Thumbs (CDN) | Deterministic per-session avatars, no backend needed |
| Static server | npx serve | Zero-config, ships with Node |
| Tunnel | Cloudflare Tunnel (cloudflared) | Free, auto TLS, works from anywhere |

---

## Branding

### Anti-pattern

Most AI products look like this:
- Dark backgrounds, glowing accents
- "Powerful", "intelligent", "autonomous" language
- Interfaces that imply something vast and unknowable
- Designed to impress, not to comfort

Pebble is the opposite.

### Pebble feels like:
- Something small, smooth, warm in your hand
- A trusted companion, not a tool or a service
- Calm and present — never urgent, never alarming
- Quietly capable — like the seneschal who runs the castle while you sleep
- A sprite, a familiar, a fetch — folklore's helpful spirits, not sci-fi's looming AIs

### Visual language

- **Rounded everything** — corners, avatars, inputs, cards. Base radius 8px, scaling to 12/16/20px. Buttons and pills use `border-radius: 9999px` (full pill).
- **Warm stone palette** — off-whites, warm greys, soft taupes — not clinical white
- **One warm accent** — terracotta `#C1654A` (hover: `#A8503A`)
- **Generous whitespace** — nothing crowded, nothing urgent
- **Human typography** — Literata for headlines (characterful serif), Lora for body and labels (warm, readable), JetBrains Mono for code/mono
- **Motion that settles** — things arrive like a pebble landing, not like a notification firing
- **Session rows** feel like a messaging inbox — flat, not cards. Active row gets a warm tinted background.

### Design tokens (from Stitch design system)

**Colours:**

| Token | Value | Use |
|---|---|---|
| `background` | `#fef8f3` | App background |
| `surface` | `#EDE8E2` | Cards, session row active bg |
| `surface-container` | `#f2ede8` | Grouped sections |
| `surface-dim` | `#ded9d4` | Subtle dividers |
| `primary` | `#2C2925` | Primary text, dark elements |
| `secondary` | `#7A746D` | Muted text, secondary labels |
| `tertiary` | `#C1654A` | Accent — buttons, done ticks, highlights |
| `tertiary-hover` | `#A8503A` | Accent hover state |
| `on-surface` | `#1d1b19` | Body text on light surfaces |
| `on-surface-variant` | `#4b463f` | Secondary body text |
| `outline` | `#7c766e` | Borders, dividers |
| `outline-variant` | `#cdc5bc` | Subtle borders |
| `error` | `#B85450` | Error state |
| `success` | `#5C8A6B` | Success/active state |
| `warning` | `#C49A3C` | Warning state |

**Typography:**

| Level | Font | Size | Weight | Line height |
|---|---|---|---|---|
| `headline-lg` | Literata | 28px | 600 | 1.2 |
| `headline-md` | Literata | 20px | 600 | 1.3 |
| `body-md` | Lora | 16px | 400 | 1.6 |
| `body-sm` | Lora | 14px | 400 | 1.5 |
| `label-md` | Lora | 13px | 500 | 1.4 |
| `label-sm` | Lora | 12px | 400 | 1.3 |
| `mono` | JetBrains Mono | 13px | 400 | 1.5 |

**Radius:**

| Token | Value |
|---|---|
| `sm` | 8px |
| `md` | 12px |
| `lg` | 16px |
| `xl` | 20px |
| `full` | 9999px |

**Spacing:** `xs: 4px` · `sm: 8px` · `md: 16px` · `lg: 24px` · `xl: 32px` · `2xl: 48px` · `sidebar: 280px`

**Component tokens:**

- **Button primary:** bg `#C1654A`, text white, radius `full`, padding `12px`
- **Button outline:** transparent bg, text `#2C2925`, radius `full`, padding `12px`
- **Input:** bg `#F5F0EB`, text `#2C2925`, radius `md`, padding `12px`
- **Message bubble (user):** bg `#F0E8E3`, text `#2C2925`, radius `lg`
- **Message bubble (agent):** bg `#EDE8E2`, text `#2C2925`, radius `lg`
- **Thought block:** transparent bg, text `#7A746D` (muted)
- **Status icon — active:** `#5C8A6B` (success green)
- **Status icon — waiting:** `#7A746D` (secondary grey)
- **Status icon — done:** `#C1654A` (terracotta)
- **Status icon — error:** `#B85450` (error red)

### Voice and copy

- Short, calm, friendly — never corporate
- *"Your agent is thinking..."* — not *"Processing request..."*
- *"Done. Anything else?"* — not *"Task completed successfully."*
- *"Start a new chat"* — not *"Create session"*
- Never use the word "AI" in the UI. Never say "powered by". Just talk.

---

## Build Order

### Phase 1 — Shell (no agent needed)
- [ ] Vite + React + Tailwind + PWA plugin + shadcn setup
- [ ] `?ws=` param read on load → stored in Zustand
- [ ] WS client module (connect, reconnect, exponential backoff)
- [ ] SessionList screen with mock SessionMeta data
- [ ] SessionCard + StatusPill components
- [ ] Responsive layout (mobile full-screen / desktop sidebar)
- [ ] Waiting screen ("Launch Pebble from your agent")

### Phase 2 — Live sessions
- [ ] session_list / session_create / session_delete
- [ ] ChatThread screen
- [ ] MessageBubble (user + agent)
- [ ] Streaming message assembly (chunk → complete)
- [ ] session_resume + session_history render
- [ ] Text input bar (mobile thumb-friendly, desktop relaxed)

### Phase 3 — Generative UI
- [ ] json-render catalog definition
- [ ] AgentUIBlock — renders spec inline in thread
- [ ] ui_action → WS on button/form interaction
- [ ] agent_push handling (proactive messages, heartbeats)

### Phase 4 — Polish
- [ ] Session status transitions (things settle, not snap)
- [ ] Unread counts on session cards
- [ ] Reconnecting / offline state UI
- [ ] "Add to Home Screen" prompt on mobile
- [ ] QR code panel on desktop (scan to open on phone)
- [ ] Dark mode (warm dark — think candlelight, not terminal)

### Phase 5 — Bootstrap Skill
- [ ] Bootstrap script (Claw variant)
- [ ] Bootstrap script (Hermes variant)
- [ ] Cloudflare tunnel integration + QR generation
- [ ] One-command update (`git pull && npm run build`)
- [ ] README for agent authors — how to make your agent Pebble-compatible

---

## Compatible Agents

Pebble is an open protocol. Any agent that implements the WebSocket spec works with Pebble.

| Agent | Status |
|---|---|
| Claw | ✓ Supported |
| Hermes | ✓ Supported |
| Custom agent | Implement the protocol → works |

To make an agent Pebble-compatible:
1. Expose a WebSocket endpoint at `/chat`
2. Implement the message types above
3. Optionally emit `agent_ui` specs using the json-render catalog
4. Ship a bootstrap skill that starts Pebble and opens/shares the URL

---

## What the User Does

```
First time:
  "Hey Claw, set up Pebble"
  → browser opens, already connected

Every time after:
  "Hey Claw, start Pebble"
  → browser opens, sessions waiting

On mobile:
  Scan the QR code on your desktop
  → Pebble loads, tap "Add to Home Screen"
  → it's an app now

Day to day:
  Open Pebble
  See your tasks at a glance
  Tap into one, pick up where you left off
  Start new ones
  Close done ones
  That's it
```

---

## Post-MVP (if it hits)

- **Voice input** — speak your task, agent responds visually
- **Push notifications** — agent pings you when a background task finishes
- **Persistent tunnel URLs** — vanity domain via Cloudflare (one-time setup)
- **React Native wrapper** — proper App Store presence via Capacitor/Expo
- **Multi-agent** — one Pebble, multiple agents, switch in session list
- **Pebble Hub** — optional hosted relay for teams (not required, never forced)

---

*Pebble v0.3 — small thing, big ripples*
*Works with Claw, Hermes, and anything that speaks the protocol*