# Pebble — Claude Code Context

> A PWA chat interface for Hermes and Open Claw agents. Warm, minimal, installable. No backend needed.

## Before you start

- **SPEC.md** — product vision, session model, rendering rationale. Read for the *why*
- **TODO.md** — the build order. Each task is self-contained. Work one task at a time, commit, move on.
- **hermes-plugin/skills/pebble-protocol/SKILL.md** — the `pebble_send` protocol (message/ui/status/push). Read before touching `AgentUIBlock` or the Hermes adapter's tool-call interception. The OpenUI Lang component catalogue is split into the sibling **pebble-protocol-ui/SKILL.md** (the agent loads it lazily when building a UI block).

## What we're building

A static React PWA that connects directly to a Hermes agent's HTTP API. No backend, no MCP server. The Pebble launcher (`main.go`) serves the app and reverse-proxies `/api/*` to Hermes from the same origin, so **on the desktop machine Pebble auto-connects to its own localhost origin with no wizard and no paste**. Tailscale is only needed to *reach* Pebble from another device: you expose the launcher with `tailscale serve`, then use the app's **"Open on phone"** button — with a tunnel up it shows a QR to scan; without one it opens the `SetupScreen` wizard that walks you through Tailscale. Access (over the tunnel) is gated by the tailnet itself — there is no API token. It talks to the agent over `GET /api/sessions` + `POST /api/sessions/{id}/chat/stream` (SSE).

The UI has two views:
- **Session list** — chat inbox, WhatsApp-style (not a task board). Active / Completed sections, each sorted by `last_updated`
- **Chat thread** — messages + inline interactive UI pushed by the agent

## Stack

| | |
|---|---|
| Framework | React + Vite (static output) |
| PWA | vite-plugin-pwa |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Generative UI | @openuidev/react-lang + react-ui (OpenUI Lang) |
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
{ type: "agent_ui", session_id, message_id, spec: string /* OpenUI Lang */, timestamp }
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

The agent communicates **only** through the `pebble_send` tool, provided by the bundled Hermes plugin (`hermes-plugin/`, installed to `~/.hermes/plugins/pebble/` by the launcher). The agent never emits plain `assistant.delta` text — all user-visible output is a `pebble_send` tool call.

- A saved/verified `{ hermes }` config (from the setup wizard) → `HermesAdapter`.
- `connect()` → `GET /api/sessions` → emits `session_list`.
- `user_message` → `POST /api/sessions/{id}/chat/stream` (SSE). Stream events translated:
  - `tool.started` for `pebble_send` → read `arguments.type` and dispatch: `message` → `agent_message` (kind `message`), `ui` → `agent_ui`, `status` → `session_status`, `push` → `agent_message` and/or `agent_ui`. A `label` on any type updates the session name. `session_status: active` is emitted once at stream start, `done` on `run.completed`.
  - `tool.started` for other tools → `agent_message` kind `thought` ("Running X…"); finalized to "Ran X" on `tool.completed` (or on stream end, so the "Thinking…" indicator never sticks).
- `ui_action` → next user turn carrying `{"ui_action":..., "payload":..., "session_id":...}` JSON envelope. The plugin's `pre_llm_call` hook parses that and injects it as structured context.

## Design language

- **Palette:** Primary `#3B82F6` (blue), Secondary `#F97316` (orange), Tertiary `#D16900` (dark orange), Neutral `#757780` (grey). Background `#ffffff`, surface `#f8f9fa`, foreground `#1e1e2e`, border `#e2e8f0`.
- **Typography:** Plus Jakarta Sans throughout (headline 700/800, body 500, label 600). JetBrains Mono for code. Body-md: 16px/500/1.6. Labels: 13px/600. Headlines: 28–32px/700.
- **Radius:** `sm:8px` `md:12px` `lg:16px` `xl:20px` `full:9999px`. Buttons and pills use `full`. Cards use `lg`. Inputs use `md`.
- **Spacing:** `xs:4 sm:8 md:16 lg:24 xl:32 2xl:48` (px). Sidebar width: `280px`.
- **Motion:** things settle, not snap. Use `transition` and `ease-out`, not instant state changes.
- **Copy:** calm and human. "Your agent is thinking..." not "Processing...". "Start a new chat" not "Create session". Never say "AI".
- **Tailwind config:** extend with the token values above. Font family `jakarta`.

## Key behaviours

- Connection is auto-derived from the origin (no `?hermes=` URL params). On boot, `main.tsx` primes the store from one of three sources (in priority order): (1) a saved config (`loadConnectionConfig()`, returning device); (2) a `#connect=` deep-link from a scanned "open on phone" QR (`consumeConnectLink()`); (3) the **origin Pebble loaded from** (`originConnectCandidate()` — now accepts localhost too, since the launcher serves app + API from that origin). For (2) and (3) the candidate is verified via `testConnection()` before it's saved, with `wsUrl` set optimistically so the gate shows `ConnectingScreen` (not a flash of the wizard) during verification, and cleared to `null` on failure. When primed, `wsUrl` holds the agent base URL as a non-null marker; `connectionConfig` holds the full `{ hermes }`. Three-state gate in `App.tsx`:
  1. `wsUrl === null` → `SetupScreen` (Tailscale wizard). This is now an **exceptional fallback** — it only appears when origin verification fails (e.g. bare `vite` dev with no launcher proxying, or a QR scanned onto a phone not yet on the tailnet). On the desktop the launcher origin verifies, so the wizard never shows at boot.
  2. `wsUrl` set but `wsStatus !== "connected"` → `ConnectingScreen` (animated dots; error variant with retry when connection permanently fails)
  3. Connected → `Layout`. The connected-but-no-sessions empty state lives inside `SessionList` ("No chats yet." + New Chat button).
- **"Open on phone"** (desktop sidebar) is the primary path to the wizard. It calls `fetchConnectInfo()` → the launcher's `GET /api/connect-info`, which reports the Tailscale tunnel URL (or null). Tunnel up → QR encoding `buildConnectLink(config, tunnelUrl)` (the link's base is the *tunnel* URL, never localhost, so the phone can reach it). No tunnel → `SetupScreen` shown as a dismissable destination (`onClose` prop) over the chat. Its final step takes an `onRecheck` callback: after the user runs `tailscale serve`, "I've run it — show QR" re-queries the launcher — tunnel found swaps straight to the QR, not found shows an inline "couldn't find it yet" retry. (Without `onRecheck`/`onClose`, the wizard is the legacy full-screen boot fallback that instead tells you to open the printed `.ts.net` URL.) Tunnel detection lives in `main.go`'s `detectTunnelURL()` (parses `tailscale serve status`).
- Connection helpers live in `src/lib/connection.ts`: `saveAndConnect()` (persist + prime store), `buildConnectLink(config, tunnelUrl?)`/`consumeConnectLink()` (the QR deep-link, config in the URL *fragment* so it never hits a server), `fetchConnectInfo()` (queries the launcher for the tunnel URL). There's no connection-settings UI: the address is just the origin Pebble loaded from (localhost on desktop), so there's nothing to configure or disconnect — the only connection affordance is the sidebar's "Open on phone" button.
- **Passphrase lock (optional, opt-in).** Set `PEBBLE_PASSPHRASE` (or `--app-passphrase`) on the launcher and `main.go` gates `/api/*` behind it: any request without a matching `pebble_auth` cookie gets a `401`. The cookie is set by `POST /api/login` (HttpOnly, SameSite=Strict, 1-year), so the secret lives only in the browser — the React app never holds it, and the browser auto-attaches it to the SSE stream. Empty passphrase → no gate (default). A 401 surfaces a store flag `authRequired` (set from both the boot `testConnection` and the adapter's `connect()` probe via an `auth_required` error event), which renders `PassphraseScreen` as the **outermost** gate in `App.tsx` — ahead of `SetupScreen`. `submitPassphrase()` in `connection.ts` does the login; on success it clears the flag and resumes connect. `/api/login` and `/api/connect-info` are never gated. Docs: DEVELOPERS.md. Caveat: stops a browser hitting `localhost:<port>` without the phrase, not someone who already controls your OS account.
- **Chat URLs are hash-routed** (`useHashRoute` in `src/lib/`). The open session mirrors to `#/session/<id>` and back (refresh, back/forward, shareable deep-link); the bare list is no hash. `activeSessionId` in the store is the source of truth — the hook just keeps the URL in sync both ways. Hash (not path) routing is deliberate: the launcher never sees the fragment, so nothing is configured server-side and `#connect=` (the QR deep-link) and the `__pending__` new-chat sentinel are both excluded from routing. The hash is preserved across the passphrase unlock, so a deep-linked chat lands you on that chat after login.
- Streaming messages: `agent_message` with `streaming: true` are assembled chunk-by-chunk. `streaming: false` = final chunk.
- `agent_message` has a `kind` field: `"thought"` (agent reasoning/tool chatter) or `"message"` (final output). Thoughts are collapsed into a subtle "thinking..." indicator while streaming, then become an expandable disclosure row. Messages render as full bubbles. Both share the same `message_id` and group together in the thread.
- `agent_ui` renders inline in the thread immediately after the preceding `agent_message` (or standalone).
- Sessions are persisted to localStorage. Message history uses IndexedDB (keyed by session_id).
- Session list is split into two sections (`SectionedList` in `SessionList`): **Active** and **Completed**. A session is Active if its status is `active`/`waiting`, *or* it was updated within the freshness window (`FRESH_WINDOW_MS`, 5 min) — so a chat you were just in doesn't drop into Completed the instant the agent stops. Older `done`/`error` sessions settle into Completed. Within each section, rows are sorted by `last_updated` descending. (`now` ticks every 30s so a fresh session re-buckets itself once the window elapses.)
- Session status is shown as a small icon (not a pill) next to the timestamp, WhatsApp-style. No labels.
- Server (`GET /api/sessions`) returns timestamps as Unix epoch **seconds** (float), with the last-activity field named `last_active` (not `updated_at`/`last_updated`). `toSessionMeta` converts via `epochToISO()`; missing it makes every session read as "now".
- Session avatars use DiceBear Thumbs, seeded by `session_id`: `https://api.dicebear.com/9.x/thumbs/svg?seed={session_id}`. Rendered as a 40×40px circle. No initials fallback needed — DiceBear always resolves.
- Deleting a session removes it immediately and permanently — no archive, no undo.
- Mobile: full-screen list → tap → full-screen thread. Back button returns to list.
- Desktop (≥768px): sidebar list + thread side by side.

## Component names (non-obvious)

These differ from what you might guess — use these exact names:

| Correct | Not |
| --- | --- |
| `SetupScreen` | `EmptyScreen`, `WaitingScreen`, `OnboardingScreen` |
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