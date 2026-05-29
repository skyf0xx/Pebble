# Pebble — Claude Code Context

> A PWA chat interface for Hermes and Open Claw agents. Warm, minimal, installable. No backend needed.

## Before you start

- **SPEC.md** — product vision, session model, rendering rationale. Read for the *why* (some sections describe the old MCP/tunnel architecture and are out of date — the transport is now Hermes-only).
- **TODO.md** — the build order. Each task is self-contained. Work one task at a time, commit, move on.
- **skills/generative-ui.md** — json-render spec format and the `render_ui` tool flow. Read before touching `AgentUIBlock` or the Hermes adapter's tool-call interception.

## What we're building

A static React PWA that connects directly to a Hermes agent's HTTP API. No backend, no MCP server, no tunnel — the user just opens `?hermes=<base_url>&token=<key>` and Pebble talks to the agent over `GET /api/sessions` + `POST /api/sessions/{id}/chat/stream` (SSE).

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
| Transport | Hermes HTTP API (SSE streaming via `fetch`) |
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
│   │   ├── connection.ts  # Adapter façade — picks config from URL, dispatches events to store
│   │   ├── adapters/      # HostAdapter implementations (currently: hermes.ts)
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

## Internal protocol (adapter ↔ store)

The Hermes adapter normalises Hermes' HTTP API into a small internal vocabulary. Components and the store only ever see this shape — they don't know about Hermes.

**ClientMessage (components → adapter via `send()`):**
```ts
{ type: "session_create", label?: string }
{ type: "session_resume", session_id: string }
{ type: "session_delete", session_id: string }
{ type: "user_message", session_id: string, content: string, timestamp: ISO8601 }
{ type: "ui_action", session_id: string, action: string, payload: Record<string,any>, timestamp: ISO8601 }
```

**AgentMessage (adapter → store via `dispatch()` in connection.ts):**
```ts
{ type: "session_list", sessions: SessionMeta[] }
{ type: "session_history", session_id: string, messages: Message[] }
{ type: "agent_message", session_id, message_id, kind: "thought"|"message", content, streaming, timestamp }
{ type: "agent_ui", session_id, message_id, spec: JsonRenderSpec, timestamp }
{ type: "session_status", session_id, status: "active"|"waiting"|"done"|"error", label? }
{ type: "error", code, message, session_id? }
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

**Hermes mapping (in `src/lib/adapters/hermes.ts`):**

- `?hermes=<base>&token=<key>` on load → `HermesAdapter`.
- `connect()` → `GET /api/sessions` → emits `session_list`.
- `user_message` → `POST /api/sessions/{id}/chat/stream` (SSE). Stream events translated:
  - `assistant.delta` → `agent_message` (streaming chunks)
  - `tool.started` for `render_ui` → pulls the spec from `arguments.spec`, emits `agent_ui`
  - `tool.started` for other tools → `agent_message` kind `thought` ("Running X…")
  - `run.completed` → final `agent_message` + `session_status: done`
- `ui_action` → next user turn carrying `{"ui_action":..., "payload":...}` JSON envelope. The agent parses that out of `user_message` content.

## Design language

- **Palette:** Primary `#3B82F6` (blue), Secondary `#F97316` (orange), Tertiary `#D16900` (dark orange), Neutral `#757780` (grey). Background `#ffffff`, surface `#f8f9fa`, foreground `#1e1e2e`, border `#e2e8f0`.
- **Typography:** Plus Jakarta Sans throughout (headline 700/800, body 500, label 600). JetBrains Mono for code. Body-md: 16px/500/1.6. Labels: 13px/600. Headlines: 28–32px/700.
- **Radius:** `sm:8px` `md:12px` `lg:16px` `xl:20px` `full:9999px`. Buttons and pills use `full`. Cards use `lg`. Inputs use `md`.
- **Spacing:** `xs:4 sm:8 md:16 lg:24 xl:32 2xl:48` (px). Sidebar width: `280px`.
- **Motion:** things settle, not snap. Use `transition` and `ease-out`, not instant state changes.
- **Copy:** calm and human. "Your agent is thinking..." not "Processing...". "Start a new chat" not "Create session". Never say "AI".
- **Tailwind config:** extend with the token values above. Font family `jakarta`.

## Key behaviours

- `?hermes=<base>&token=<key>` is parsed on load by `pickConfig()` and stored in Zustand (`wsUrl` holds the Hermes base URL as a non-null marker; `connectionConfig` holds the full config). Three-state gate in `App.tsx`:
  1. `wsUrl === null` (no `?hermes=` param) → `EmptyScreen` ("Launch Pebble from your agent")
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