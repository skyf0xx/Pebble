# Pebble — Claude Code Context

> A PWA chat interface for AI agents. Warm, minimal, installable. No backend needed.

## Before you start

- **SPEC.md** — full product design, session model, thought/message rendering, protocol rationale. Read this when you need the *why*.
- **TODO.md** — the build order. Each task is self-contained. Work one task at a time, commit, move on.
- **.claude/skills/ws-protocol.md** — WebSocket protocol detail. Read before touching `ws.ts` or message types.
- **.claude/skills/mock-agent.md** — how to run the mock agent for local dev without a real agent.

## What we're building

A static React PWA that connects to an AI agent over WebSocket. The agent serves both the static files (port 3000) and the WS endpoint (port 3001). A Cloudflare Tunnel makes both reachable from anywhere — including mobile — without config.

The UI has two views:
- **Session list** — chat inbox sorted by `last_updated` (WhatsApp-style, not a task board)
- **Chat thread** — messages + inline interactive UI pushed by the agent

## Stack

| | |
|---|---|
| Framework | React + Vite (static output) |
| PWA | vite-plugin-pwa |
| Styling | Tailwind CSS v3 |
| Components | shadcn/ui |
| Generative UI | @json-render/react |
| State | Zustand |
| WebSocket | reconnecting-websocket |
| Persistence | localStorage + IndexedDB |
| Icons | lucide-react |
| Avatars | DiceBear Thumbs (CDN) |

## Project structure

```
pebble/
├── src/
│   ├── components/
│   │   ├── sessions/      # SessionList, SessionRow, StatusIcon
│   │   ├── chat/          # ChatThread, MessageBubble, InputBar
│   │   └── ui/            # AgentUIBlock, agent_push overlay
│   ├── lib/
│   │   ├── ws.ts          # WebSocket client (reconnecting-websocket wrapper)
│   │   └── storage.ts     # localStorage/IndexedDB helpers
│   ├── store/
│   │   └── index.ts       # Zustand store (sessions, messages, ws state)
│   ├── types.ts            # Shared TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── public/
├── CLAUDE.md
├── TODO.md
└── skills/                # Project skill files
```

## WebSocket protocol (summary)

**Client → Agent:**
```ts
{ type: "session_create", label?: string }
{ type: "session_resume", session_id: string }
{ type: "session_delete", session_id: string }
{ type: "user_message", session_id: string, content: string, timestamp: ISO8601 }
{ type: "ui_action", session_id: string, action: string, payload: Record<string,any>, timestamp: ISO8601 }
{ type: "ping" }
```

**Agent → Client:**
```ts
{ type: "session_list", sessions: SessionMeta[] }
{ type: "session_history", session_id: string, messages: Message[] }
{ type: "agent_message", session_id: string, message_id: string, content: string, streaming: boolean, timestamp: ISO8601 }
{ type: "agent_ui", session_id: string, message_id: string, spec: JsonRenderSpec, timestamp: ISO8601 }
{ type: "session_status", session_id: string, status: "active"|"waiting"|"done"|"error", label?: string }
{ type: "agent_push", session_id: string|null, content?: string, spec?: JsonRenderSpec, priority: "low"|"normal"|"high" }
{ type: "pong" }
{ type: "error", code: string, message: string, session_id?: string }
```

**SessionMeta shape:**
```ts
{
  session_id: string
  label: string
  status: "active" | "waiting" | "done" | "error"
  last_message: string
  last_updated: ISO8601
  unread: number
}
```

**Connection:** URL param `?ws=wss://...` on load. Auto-reconnect: exponential backoff 1s → 2s → 4s → 8s → max 30s. On reconnect: re-request `session_list`, resume active session.

## Design language

- **Palette:** Primary `#3B82F6` (blue), Secondary `#F97316` (orange), Tertiary `#D16900` (dark orange), Neutral `#757780` (grey). Background `#ffffff`, surface `#f8f9fa`, foreground `#1e1e2e`, border `#e2e8f0`.
- **Typography:** Plus Jakarta Sans throughout (headline 700/800, body 500, label 600). JetBrains Mono for code. Body-md: 16px/500/1.6. Labels: 13px/600. Headlines: 28–32px/700.
- **Radius:** `sm:8px` `md:12px` `lg:16px` `xl:20px` `full:9999px`. Buttons and pills use `full`. Cards use `lg`. Inputs use `md`.
- **Spacing:** `xs:4 sm:8 md:16 lg:24 xl:32 2xl:48` (px). Sidebar width: `280px`.
- **Motion:** things settle, not snap. Use `transition` and `ease-out`, not instant state changes.
- **Copy:** calm and human. "Your agent is thinking..." not "Processing...". "Start a new chat" not "Create session". Never say "AI".
- **Tailwind config:** extend with the token values above. Font family `jakarta`.

## Key behaviours

- `?ws=` param is read on load and stored in Zustand. Three-state gate in `App.tsx`:
  1. `wsUrl === null` (no `?ws=` param) → `EmptyScreen` ("Launch Pebble from your agent")
  2. `wsUrl` set but `wsStatus !== "connected"` → `ConnectingScreen` (animated dots; error variant with retry when connection permanently fails)
  3. Connected + no sessions → `EmptyScreen` (same component, connected state copy)
- Streaming messages: `agent_message` with `streaming: true` are assembled chunk-by-chunk. `streaming: false` = final chunk.
- `agent_message` has a `kind` field: `"thought"` (agent reasoning/tool chatter) or `"message"` (final output). Thoughts are collapsed into a subtle "thinking..." indicator while streaming, then become an expandable disclosure row. Messages render as full bubbles. Both share the same `message_id` and group together in the thread.
- `agent_ui` renders inline in the thread immediately after the preceding `agent_message` (or standalone).
- Sessions are persisted to localStorage. Message history uses IndexedDB (keyed by session_id).
- Session list is sorted by `last_updated` descending — most recent first, always. No grouping by status.
- Session status is shown as a small icon (not a pill) next to the timestamp, WhatsApp-style. No labels.
- Session avatars use DiceBear Thumbs, seeded by `session_id`: `https://api.dicebear.com/9.x/thumbs/svg?seed={session_id}`. Rendered as a 40×40px circle. No initials fallback needed — DiceBear always resolves.
- Deleting a session removes it immediately and permanently — no archive, no undo.
- Mobile: full-screen list → tap → full-screen thread. Back button returns to list.
- Desktop (≥768px): sidebar list + thread side by side.

## Component names (non-obvious)

These differ from what you might guess — use these exact names:

| Correct | Not |
| --- | --- |
| `EmptyScreen` | `WaitingScreen` |
| `ConnectingScreen` | `LoadingScreen`, `SplashScreen` |
| `SessionRow` | `SessionCard` |
| `StatusIcon` | `StatusPill`, `StatusBadge` |
| `ThoughtBlock` | `ThinkingBubble`, `ReasoningBlock` |
| `MessageBubble` | `ChatBubble`, `Message` |
| `AgentUIBlock` | `JsonRenderBlock`, `UIBlock` |

## Do not

- No backend, no auth, no accounts.
- No dark mode until Phase 4.
- Don't reach for complexity — this is a static PWA. Keep it lean.