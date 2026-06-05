import type { AgentMessage, AgentUISpec, ClientMessage, SessionMeta, Message } from "../../types";
import type { AdapterStatus, HostAdapter } from "./types";

/**
 * Hermes adapter — talks to a Hermes agent's HTTP API directly.
 *
 * The agent communicates through the Pebble plugin's single `pebble_send` tool
 * (see hermes-plugin/). All user-visible output — text, UI blocks, status
 * changes, pushes — arrives as `pebble_send` tool calls in the SSE stream; the
 * agent never emits plain `assistant.delta` text. This adapter reads each
 * `pebble_send` call's arguments and maps `type` to an internal event:
 *
 *   type "message" → agent_message (kind "message")
 *   type "ui"      → agent_ui
 *   type "status"  → session_status
 *   type "push"    → agent_message and/or agent_ui (+ unread)
 *
 * Any other tool the agent runs is surfaced as a "thought" so the user sees
 * activity. The handler returns `{ ok: true }` server-side, so the turn
 * continues without a round-trip.
 *
 * Connection is configured via the SetupScreen wizard (or a #connect= QR
 * deep-link) and persisted to localStorage — there are no ?hermes= URL params.
 */

interface HermesConfig {
  baseUrl: string;
}

interface PendingToolCall {
  name: string;
  args: string; // streamed/accumulated JSON
}

const PEBBLE_SEND_TOOL = "pebble_send";

// The agent must reply via the pebble_send tool — bare assistant text never
// reaches the UI. When a turn ends with text but no pebble_send call, we
// silently re-prompt the agent (once) with this nudge instead of surfacing the
// stray text. The user sees nothing; the agent just gets told to use the tool.
const PEBBLE_SEND_NUDGE =
  "[Pebble] Your previous reply was not delivered: all user-visible output " +
  "must go through the pebble_send tool, but you responded with plain text. " +
  "Re-send your response now as a pebble_send call (type \"message\" for text, " +
  '"ui" for an interactive block). Do not reply with plain text again.';

/**
 * Server-side marker tagging a session as Pebble-owned. Lives in the session
 * title (there is no metadata column) so ownership survives cross-device.
 *
 * The on-wire tag is `[pebble][<ms>] <human label>` — the static `[pebble]`
 * identifies ownership, and the millisecond timestamp makes every title unique.
 * Hermes enforces unique session titles, so a bare `[pebble] New chat` collides
 * across blank chats and the PATCH is rejected, leaving the session untagged
 * (and thus filtered out on the next refresh). The timestamp segment guarantees
 * uniqueness even when two chats share the same human label.
 *
 * Use the helpers below rather than building/stripping the tag by hand:
 *   isPebbleOwned(title) — the ownership filter
 *   tagLabel(human)      — build a fresh, unique tagged title to write
 *   displayLabel(title)  — strip the tag for display
 */
export const PEBBLE_PREFIX = "[pebble]";

// [pebble][<digits>] <rest> — the timestamp segment is optional so titles
// written by older builds (bare "[pebble] foo") still register as owned.
const PEBBLE_TAG_RE = /^\[pebble\](?:\[\d+\])?\s*/;

/** True when a server title carries the Pebble ownership tag. */
export function isPebbleOwned(title: string): boolean {
  return PEBBLE_TAG_RE.test(title);
}

/**
 * Human label given to a freshly created chat before it's named. It's a
 * placeholder, not a real title — the store keeps such a session "provisional"
 * so the user's first message (or the agent's label) can still replace it.
 */
export const PEBBLE_PLACEHOLDER_LABEL = "New chat";

/** Build a fresh, collision-proof tagged title from a human label. */
export function tagLabel(human: string): string {
  return `${PEBBLE_PREFIX}[${Date.now()}] ${human}`;
}

/**
 * Strip the server-side ownership tag for display. The tag lives in the session
 * title for cross-device ownership but should never be shown to the user.
 */
export function displayLabel(label: string): string {
  return label.replace(PEBBLE_TAG_RE, "");
}

/**
 * A session title is "unnamed" when it's empty or the "Untitled" placeholder
 * toSessionMeta() falls back to. Mirrors the store's isUnnamed(), kept local to
 * avoid an adapter→store import cycle.
 */
function isUnnamedTitle(label: string): boolean {
  const l = label.trim();
  return l === "" || l === "Untitled";
}

interface PebbleSendArgs {
  type?: "message" | "ui" | "status" | "push";
  session_id?: string;
  content?: string;
  spec?: AgentUISpec;
  status?: SessionMeta["status"];
  label?: string;
  priority?: "low" | "normal" | "high";
}

export interface TestResult {
  ok: boolean;
  /** Human-readable reason when ok is false, for inline display in the wizard. */
  error?: string;
  /**
   * The origin is reachable but the launcher's passphrase gate rejected us
   * (HTTP 401) — we need to log in, not reconfigure. Distinct from a transport
   * failure so the boot path can show the PassphraseScreen instead of the
   * Tailscale wizard.
   */
  authRequired?: boolean;
}

/**
 * Validate a base URL by hitting GET /api/sessions, without opening a live
 * adapter. Used by the setup wizard to verify the Tailscale link before saving
 * it. Distinguishes the failure modes the user can actually act on: unreachable
 * host (Tailscale down / wrong URL), other.
 */
export async function testConnection(baseUrl: string): Promise<TestResult> {
  const base = baseUrl.replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) {
    return { ok: false, error: "Enter a full URL starting with https://" };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const r = await fetch(`${base}/api/sessions?limit=1`, { headers });
    if (r.ok) return { ok: true };
    // 401 = the launcher's passphrase gate. The origin is fine; we just need to
    // unlock it. Surface that distinctly so the boot path shows the passphrase
    // screen rather than the (irrelevant) Tailscale wizard.
    if (r.status === 401) return { ok: false, authRequired: true };
    return { ok: false, error: `Agent responded with an error (${r.status}).` };
  } catch {
    // A network/TLS failure here is almost always: Tailscale not running on this
    // device, the agent not started, or a typo'd hostname.
    return {
      ok: false,
      error:
        "Couldn't reach your agent. Make sure Tailscale is running on this device and the agent is started.",
    };
  }
}

// Internal sentinel: listSessions() throws this when the launcher's passphrase
// gate returns 401, so connect() can distinguish "need to unlock" from a real
// transport failure and emit an `auth_required` error event.
const AUTH_REQUIRED_ERROR = "PEBBLE_AUTH_REQUIRED";

export class HermesAdapter implements HostAdapter {
  private cfg: HermesConfig;
  private eventHandler: ((msg: AgentMessage) => void) | null = null;
  private statusHandler: ((status: AdapterStatus) => void) | null = null;
  private activeStreams = new Set<AbortController>();

  constructor(cfg: HermesConfig) {
    this.cfg = cfg;
  }

  async connect() {
    this.emitStatus("connecting");
    try {
      // Probe: list sessions. If it works, we're connected.
      const sessions = await this.listSessions();
      this.emit({ type: "session_list", sessions });
      this.emitStatus("connected");
    } catch (err) {
      // A 401 here is the launcher's passphrase gate (e.g. a returning device
      // whose auth cookie expired). Surface it as a typed error so the store can
      // show the PassphraseScreen instead of the generic "lost the signal"
      // state. The status still goes to disconnected — App.tsx prefers
      // authRequired over wsStatus in the gate.
      if (err instanceof Error && err.message === AUTH_REQUIRED_ERROR) {
        this.emit({ type: "error", code: "auth_required", message: "Passphrase required." });
      } else {
        console.error("[hermes] connect failed", err);
      }
      this.emitStatus("disconnected");
    }
  }

  disconnect() {
    for (const ctrl of this.activeStreams) ctrl.abort();
    this.activeStreams.clear();
    this.emitStatus("disconnected");
  }

  send(msg: ClientMessage) {
    // Pebble ClientMessage → Hermes HTTP calls. Fire-and-forget; results
    // come back via emit().
    void this.dispatch(msg);
  }

  onEvent(handler: (msg: AgentMessage) => void) {
    this.eventHandler = handler;
  }

  onStatus(handler: (status: AdapterStatus) => void) {
    this.statusHandler = handler;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private emit(msg: AgentMessage) {
    this.eventHandler?.(msg);
  }

  private emitStatus(s: AdapterStatus) {
    this.statusHandler?.(s);
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json" };
  }

  private async dispatch(msg: ClientMessage) {
    switch (msg.type) {
      case "session_create": {
        const session = await this.createSession(msg.label);
        // Announce the new session first (with its authoritative id) so the
        // store can claim ownership before the list refresh filters it in.
        this.emit({
          type: "session_status",
          session_id: session.session_id,
          status: "done",
          label: session.label,
        });
        const sessions = await this.listSessions();
        this.emit({ type: "session_list", sessions });
        return;
      }

      case "session_resume": {
        const messages = await this.getHistory(msg.session_id);
        this.emit({ type: "session_history", session_id: msg.session_id, messages });
        return;
      }

      case "session_delete": {
        await this.deleteSession(msg.session_id);
        const sessions = await this.listSessions();
        this.emit({ type: "session_list", sessions });
        return;
      }

      case "user_message": {
        await this.streamChat(msg.session_id, msg.content);
        return;
      }

      case "ui_action": {
        // Pebble's UI action becomes the next user turn carrying the action
        // payload. The Pebble plugin's pre_llm_call hook parses this envelope
        // (and reads session_id from it for the typing indicator), so include
        // session_id alongside the action and payload.
        const content = JSON.stringify({
          ui_action: msg.action,
          payload: msg.payload,
          session_id: msg.session_id,
        });
        await this.streamChat(msg.session_id, content);
        return;
      }
    }
  }

  private async listSessions(): Promise<SessionMeta[]> {
    const r = await fetch(`${this.cfg.baseUrl}/api/sessions?limit=100`, {
      headers: this.headers(),
    });
    if (r.status === 401) throw new Error(AUTH_REQUIRED_ERROR);
    if (!r.ok) throw new Error(`listSessions ${r.status}`);
    const body = await r.json();
    const raw: HermesSession[] = body.sessions ?? body.data ?? body ?? [];
    return raw.map(toSessionMeta);
  }

  private async createSession(label?: string): Promise<SessionMeta> {
    // Create with a tagged title when we have a label. tagLabel() embeds a
    // millisecond timestamp so the title is unique — Hermes rejects duplicate
    // titles, and a bare "[pebble] New chat" collides across blank chats.
    const r = await fetch(`${this.cfg.baseUrl}/api/sessions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(label ? { title: tagLabel(label) } : {}),
    });
    if (!r.ok) throw new Error(`createSession ${r.status}`);
    const body = await r.json();
    const session = toSessionMeta(body.session ?? body);
    // Ensure the session is tagged Pebble-owned from birth, so the ownership
    // filter keeps it on the create-time list refresh. A real label (passed in)
    // is already tagged above; otherwise tag the auto-title.
    if (!isPebbleOwned(session.label)) {
      const seed = isUnnamedTitle(session.label) ? PEBBLE_PLACEHOLDER_LABEL : session.label;
      // Await so the tag is on the server before dispatch() re-lists and the
      // ownership filter runs — otherwise the brand-new session is filtered out.
      // Keep the local label exactly what was written (same timestamp segment).
      session.label = await this.patchTitle(session.session_id, seed);
    }
    return session;
  }

  private async deleteSession(id: string): Promise<void> {
    await fetch(`${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.headers(),
    });
  }

  /**
   * Tag a human label and write it to the server title. Returns the tagged
   * title that was written, so callers keep their local label in sync with the
   * server (the timestamp segment is generated once, here). Awaitable: the
   * create flow awaits it so the subsequent session_list refresh sees the tag
   * and the ownership filter keeps the session.
   */
  private async patchTitle(id: string, label: string): Promise<string> {
    const title = isPebbleOwned(label) ? label : tagLabel(label);
    await fetch(`${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ title }),
    });
    return title;
  }

  /**
   * Persist the agent's final label back to the server title, tagged with the
   * `[pebble]` prefix so the session is recognisable as Pebble-owned across
   * devices. Fire-and-forget — it must never block or break the SSE stream.
   */
  private persistLabel(id: string, label: string): void {
    void this.patchTitle(id, label).catch(() => {
      // Best-effort: a failed title write just leaves the session untagged
      // server-side; the local label is unaffected.
    });
  }

  private async getHistory(id: string): Promise<Message[]> {
    const r = await fetch(
      `${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(id)}/messages`,
      { headers: this.headers() },
    );
    if (!r.ok) return [];
    const body = await r.json();
    const raw: HermesHistoryItem[] = body.messages ?? body.data ?? body ?? [];
    return raw.flatMap((m) => toMessages(id, m));
  }

  private async streamChat(sessionId: string, content: string, isNudge = false) {
    const ctrl = new AbortController();
    this.activeStreams.add(ctrl);

    // Track whether the agent honored the protocol. If a turn produces bare
    // assistant text but never calls pebble_send, we silently re-prompt it
    // (once — guarded by isNudge) rather than dropping the reply on the floor.
    let sawPebbleSend = false;
    let sawBareText = false;

    // Monotonic counter so each tool.started gets a unique synthetic call id
    // when the stream omits call_id (Hermes correlates by message_id, which is
    // shared across every tool call in a turn — not unique per call).
    let callSeq = 0;

    // Non-pebble_send tools are surfaced as "thought" bubbles. We track the
    // open ones so the finally block can finalize any that never received their
    // tool.completed (interrupted / aborted / errored stream), otherwise the
    // "Thinking…" indicator sticks forever. pebble_send calls are NOT tracked
    // here — they render their content immediately and have nothing to finalize.
    const pendingThoughts = new Map<string, PendingToolCall>();
    const flushThoughts = () => {
      for (const [callId, pending] of pendingThoughts) {
        this.emit({
          type: "agent_message",
          session_id: sessionId,
          message_id: callId,
          kind: "thought",
          content: `Ran ${pending.name}`,
          streaming: false,
          timestamp: new Date().toISOString(),
        });
      }
      pendingThoughts.clear();
    };

    try {
      const res = await fetch(
        `${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/chat/stream`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ input: content }),
          signal: ctrl.signal,
        },
      );
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

      this.emit({
        type: "session_status",
        session_id: sessionId,
        status: "active",
      });

      for await (const evt of parseSSE(res.body)) {
        const { event, data } = evt;

        switch (event) {
          case "tool.started": {
            const name = data.name ?? data.tool_name ?? "tool";
            const callId = data.call_id ?? data.id ?? `call-${Date.now()}-${callSeq++}`;
            const argsRaw = data.args ?? data.arguments ?? data.input ?? {};
            const args = typeof argsRaw === "string" ? argsRaw : JSON.stringify(argsRaw);

            if (name === PEBBLE_SEND_TOOL) {
              // All user-visible output flows through pebble_send. Render it now.
              sawPebbleSend = true;
              this.handlePebbleSend(sessionId, callId, safeParse(args) as PebbleSendArgs | null);
            } else {
              // Any other tool run is agent activity — show it as a thought.
              pendingThoughts.set(callId, { name, args });
              this.emit({
                type: "agent_message",
                session_id: sessionId,
                message_id: callId,
                kind: "thought",
                content: `Running ${name}…`,
                streaming: true,
                timestamp: new Date().toISOString(),
              });
            }
            break;
          }

          case "tool.completed": {
            // Hermes omits call_id here and reuses the turn's message_id, so we
            // can't match the exact tool.started. Finalize by tool name: take
            // the most recent still-open thought for this tool.
            const explicitId = data.call_id ?? data.id;
            const name = data.name ?? data.tool_name;
            let callId = explicitId && pendingThoughts.has(explicitId) ? explicitId : undefined;
            if (!callId && name) {
              for (const [id, pending] of pendingThoughts) {
                if (pending.name === name) callId = id;
              }
            }
            if (!callId) break; // pebble_send or unknown — nothing to finalize
            const pending = pendingThoughts.get(callId)!;
            pendingThoughts.delete(callId);
            this.emit({
              type: "agent_message",
              session_id: sessionId,
              message_id: callId,
              kind: "thought",
              content: `Ran ${pending.name}`,
              streaming: false,
              timestamp: new Date().toISOString(),
            });
            break;
          }

          // Bare assistant text is NOT rendered — all user-visible output must
          // come through pebble_send. We only note that the agent emitted text
          // so run.completed can decide whether to nudge it back on-protocol.
          case "assistant.delta":
          case "assistant.completed": {
            const text = data.delta ?? data.content ?? "";
            if (typeof text === "string" && text.trim()) sawBareText = true;
            break;
          }

          case "run.completed": {
            flushThoughts();
            // Agent answered in plain text without ever calling pebble_send:
            // silently re-prompt it to use the tool (once). Keep the status
            // "active" — the nudge turn continues the work, so the user just
            // sees the typing indicator until a real pebble_send arrives.
            if (!sawPebbleSend && sawBareText && !isNudge) {
              void this.streamChat(sessionId, PEBBLE_SEND_NUDGE, true);
              break;
            }
            this.emit({
              type: "session_status",
              session_id: sessionId,
              status: "done",
            });
            break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[hermes] stream error", err);
        this.emit({
          type: "session_status",
          session_id: sessionId,
          status: "error",
        });
      }
    } finally {
      // Whatever happened (normal end, error, abort), don't leave a tool thought
      // stuck in its streaming "Thinking…" state.
      flushThoughts();
      this.activeStreams.delete(ctrl);
    }
  }

  /**
   * Translate one `pebble_send` tool call into the internal event(s) the store
   * understands. `callId` is reused as the message_id so each send renders as
   * its own message/UI block and re-renders idempotently if repeated.
   */
  private handlePebbleSend(sessionId: string, callId: string, args: PebbleSendArgs | null) {
    if (!args) return;
    const now = new Date().toISOString();

    // A label can ride along on any type — apply it without disturbing the
    // in-progress "active" status (run.completed flips it to "done" later).
    if (args.label) {
      this.emit({
        type: "session_status",
        session_id: sessionId,
        status: "active",
        label: args.label,
      });
      // Write the final label back to the server title (prefixed) so the
      // session is tagged Pebble-owned and syncs across devices.
      this.persistLabel(sessionId, args.label);
    }

    switch (args.type) {
      case "message": {
        if (!args.content) return;
        this.emit({
          type: "agent_message",
          session_id: sessionId,
          message_id: callId,
          kind: "message",
          content: args.content,
          streaming: false,
          timestamp: now,
        });
        return;
      }

      case "ui": {
        if (!args.spec) return;
        this.emit({
          type: "agent_ui",
          session_id: sessionId,
          message_id: callId,
          spec: args.spec,
          timestamp: now,
        });
        return;
      }

      case "status": {
        if (!args.status) return;
        this.emit({
          type: "session_status",
          session_id: sessionId,
          status: args.status,
          label: args.label,
        });
        return;
      }

      case "push": {
        // A push can carry text, a UI block, or both.
        if (args.content) {
          this.emit({
            type: "agent_message",
            session_id: sessionId,
            message_id: callId,
            kind: "message",
            content: args.content,
            streaming: false,
            timestamp: now,
          });
        }
        if (args.spec) {
          this.emit({
            type: "agent_ui",
            session_id: sessionId,
            message_id: `${callId}-ui`,
            spec: args.spec,
            timestamp: now,
          });
        }
        return;
      }
    }
  }
}

// ── Hermes payload shapes (defensive — fields are best-effort) ──────────────

interface HermesSession {
  id?: string;
  session_id?: string;
  title?: string;
  label?: string;
  status?: string;
  last_message?: string;
  preview?: string;
  // Hermes returns timestamps as Unix epoch *seconds* (float), not ISO strings.
  // `last_active` is the real "last updated" field; updated_at/last_updated are
  // kept as defensive fallbacks in case the shape ever changes.
  last_active?: number;
  started_at?: number;
  updated_at?: string;
  last_updated?: string;
}

interface HermesToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface HermesHistoryItem {
  id?: string;
  message_id?: string;
  // OpenAI-style roles: "user" | "assistant" | "tool".
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  text?: string;
  kind?: string;
  // An assistant turn carries its tool invocations here; the pebble_send
  // payload lives in tool_calls[].function.arguments, not in `content`.
  tool_calls?: HermesToolCall[] | null;
  // Set on `role: "tool"` result rows (which we drop). Documented for shape.
  tool_name?: string | null;
  tool_call_id?: string | null;
  created_at?: string;
  timestamp?: string;
}

function toSessionMeta(s: HermesSession): SessionMeta {
  const id = s.session_id ?? s.id ?? "";
  const serverLabel = s.title ?? s.label ?? "";
  return {
    session_id: id,
    label: serverLabel || "Untitled",
    // A real server-side title is authoritative; a missing one is a placeholder
    // that a derived title (user/agent) may replace. mergeSessions() relies on
    // this to know when it's safe to keep a better local label.
    labelProvisional: !serverLabel,
    // A session fetched from the list is at rest, not actively running. Only a
    // live turn (streamChat) flips it to "active"; run.completed flips it back.
    // Defaulting to "active" made every session animate "thinking" forever.
    status: normaliseStatus(s.status),
    last_message: s.last_message ?? s.preview ?? "",
    last_updated:
      epochToISO(s.last_active) ??
      epochToISO(s.started_at) ??
      s.updated_at ??
      s.last_updated ??
      new Date().toISOString(),
    unread: 0,
  };
}

/**
 * Hermes serialises timestamps as Unix epoch *seconds* (a float, e.g.
 * 1780370739.200545). Convert to an ISO string; return undefined for missing
 * or non-finite input so the caller can fall through to its next fallback.
 */
function epochToISO(seconds: number | undefined): string | undefined {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1000).toISOString();
}

function normaliseStatus(raw: string | undefined): SessionMeta["status"] {
  switch (raw) {
    case "active":
    case "running":
    case "in_progress":
      return "active";
    case "waiting":
    case "needs_input":
      return "waiting";
    case "error":
    case "failed":
      return "error";
    default:
      // Resting / completed / unknown → done (no animated indicator).
      return "done";
  }
}

/**
 * Map one Hermes history item to zero or more internal Messages.
 *
 * Hermes stores turns OpenAI-style:
 *  - `role: "user"`      → one user message.
 *  - `role: "assistant"` with `tool_calls` → the agent's real output. The
 *    pebble_send payload lives in `tool_calls[].function.arguments` (NOT in
 *    `content`, which is empty). Each pebble_send call becomes a message / UI
 *    block; any other tool becomes a "Ran X" thought.
 *  - `role: "assistant"` plain text (no tool_calls) → text the model leaked
 *    outside pebble_send. The live path nudges against this; in history we keep
 *    it as a quiet thought rather than a full bubble.
 *  - `role: "tool"`      → the pebble_send *result* envelope, a duplicate of the
 *    assistant call above. Dropped entirely.
 */
function toMessages(sessionId: string, m: HermesHistoryItem): Message[] {
  const baseId = m.message_id ?? m.id ?? `msg-${Math.random()}`;
  const timestamp = m.created_at ?? m.timestamp ?? new Date().toISOString();

  // Tool result rows are duplicates of the assistant tool_call — drop them.
  if (m.role === "tool") return [];

  const text = flattenContent(m);

  if (m.role === "user") {
    return [{ id: baseId, session_id: sessionId, role: "user", kind: "message", content: text, timestamp }];
  }

  // Assistant turn. If it invoked tools, the payload is in tool_calls.
  const calls = m.tool_calls ?? [];
  if (calls.length > 0) {
    return calls.map((call, i) => {
      const id = call.id ?? `${baseId}-${i}`;
      const name = call.function?.name;
      if (name === PEBBLE_SEND_TOOL) {
        const unwrapped = unwrapPebbleEnvelope(call.function?.arguments ?? "");
        // ui / status payloads have no text; push/message carry content.
        const kind: Message["kind"] = unwrapped.content ? "message" : unwrapped.spec ? "message" : "thought";
        return {
          id,
          session_id: sessionId,
          role: "agent",
          kind,
          content: unwrapped.content,
          uiSpec: unwrapped.spec,
          timestamp,
        };
      }
      // Any other tool → a "Ran X" thought, matching the live stream.
      return {
        id,
        session_id: sessionId,
        role: "agent",
        kind: "thought",
        content: name ? `Ran ${name}` : "Ran tool",
        timestamp,
      };
    });
  }

  // Plain assistant text with no tool call is output the model leaked outside
  // pebble_send (typically a stray "the tool succeeded" coda after the real
  // reply). The live path never renders these — it only nudges against them —
  // so drop them here too, otherwise every turn grows a pointless "Show
  // thinking" disclosure.
  return [];
}

function flattenContent(m: HermesHistoryItem): string {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .map((c) => (c.type === "text" || c.type === "output_text" ? c.text ?? "" : ""))
      .join("");
  }
  return m.text ?? "";
}

/**
 * Unwrap a `pebble_send` call's `arguments` into its displayable text and any
 * inline UI spec. The arguments are the bare payload `{type,content,spec,...}`,
 * but we also defensively peel a `{ok, sent: {...}}` result wrapper in case one
 * arrives that way. We pull out `content` (for `message`/`push`) and `spec`
 * (for `ui`/`push`). `status` payloads carry nothing to render.
 */
function unwrapPebbleEnvelope(raw: string): { content: string; spec?: AgentUISpec } {
  const parsed = safeParse(raw.trim());
  if (!parsed) return { content: "" };

  // Bare `{type, content}` args, or a `{ok, sent: {...}}` result wrapper.
  const sent =
    parsed.sent && typeof parsed.sent === "object"
      ? (parsed.sent as Record<string, unknown>)
      : parsed;

  const content =
    (sent.type === "message" || sent.type === "push") && typeof sent.content === "string"
      ? sent.content
      : "";
  const spec =
    (sent.type === "ui" || sent.type === "push") && typeof sent.spec === "string" && sent.spec.trim() !== ""
      ? (sent.spec as AgentUISpec)
      : undefined;

  return { content, spec };
}

// ── SSE parser ──────────────────────────────────────────────────────────────

interface SSEEvent {
  event: string;
  data: Record<string, unknown> & { delta?: string; text?: string; name?: string; tool_name?: string; call_id?: string; id?: string; args?: unknown; arguments?: unknown; input?: unknown };
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const parsed = parseChunk(chunk);
      if (parsed) yield parsed;
    }
  }
}

function parseChunk(chunk: string): SSEEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  if (raw === "[DONE]") return null;
  const data = safeParse(raw) ?? { raw };
  return { event, data };
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
