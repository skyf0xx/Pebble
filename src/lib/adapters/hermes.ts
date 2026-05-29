import type { AgentMessage, AgentUISpec, ClientMessage, SessionMeta, Message } from "../../types";
import type { AdapterStatus, HostAdapter } from "./types";

/**
 * Hermes adapter — talks to a Hermes agent's HTTP API directly. The agent
 * exposes a `render_ui` tool; when the SSE stream emits a tool.started for that
 * name, the adapter pulls out the json-render spec and surfaces it as an
 * `agent_ui` event, then immediately replies `{ ok: true }` so the agent's turn
 * continues.
 *
 * URL: ?hermes=<base_url>&token=<api_key>
 */

interface HermesConfig {
  baseUrl: string;
  token?: string;
}

interface PendingToolCall {
  name: string;
  args: string; // streamed/accumulated JSON
}

const RENDER_UI_TOOL = "render_ui";

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
      console.error("[hermes] connect failed", err);
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
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.token) h["Authorization"] = `Bearer ${this.cfg.token}`;
    return h;
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
        // payload — Hermes has no native concept of ui_action, so we feed it
        // back as structured input the agent can read.
        const content = JSON.stringify({
          ui_action: msg.action,
          payload: msg.payload,
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
    if (!r.ok) throw new Error(`listSessions ${r.status}`);
    const body = await r.json();
    const raw: HermesSession[] = body.sessions ?? body.data ?? body ?? [];
    return raw.map(toSessionMeta);
  }

  private async createSession(label?: string): Promise<SessionMeta> {
    const r = await fetch(`${this.cfg.baseUrl}/api/sessions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(label ? { title: label } : {}),
    });
    if (!r.ok) throw new Error(`createSession ${r.status}`);
    const body = await r.json();
    return toSessionMeta(body.session ?? body);
  }

  private async deleteSession(id: string): Promise<void> {
    await fetch(`${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.headers(),
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
    return raw.map((m) => toMessage(id, m));
  }

  private async streamChat(sessionId: string, content: string) {
    const ctrl = new AbortController();
    this.activeStreams.add(ctrl);

    // Tracked out here so the finally block can finalize any tool thought that
    // never received its tool.completed (interrupted / aborted / errored stream),
    // otherwise the "Thinking…" indicator sticks forever.
    const pendingCalls = new Map<string, PendingToolCall>();
    const flushPending = () => {
      for (const [callId, pending] of pendingCalls) {
        if (pending.name === RENDER_UI_TOOL) continue;
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
      pendingCalls.clear();
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

      let assistantMessageId = `agent-${Date.now()}`;
      let assistantBuffer = "";

      for await (const evt of parseSSE(res.body)) {
        const { event, data } = evt;

        switch (event) {
          case "assistant.delta": {
            const delta = data.delta ?? data.text ?? "";
            assistantBuffer += delta;
            this.emit({
              type: "agent_message",
              session_id: sessionId,
              message_id: assistantMessageId,
              kind: "message",
              content: assistantBuffer,
              streaming: true,
              timestamp: new Date().toISOString(),
            });
            break;
          }

          case "tool.started": {
            const name = data.name ?? data.tool_name ?? "tool";
            const callId = data.call_id ?? data.id ?? `call-${Date.now()}`;
            const argsRaw = data.arguments ?? data.input ?? {};
            const args = typeof argsRaw === "string" ? argsRaw : JSON.stringify(argsRaw);
            pendingCalls.set(callId, { name, args });

            if (name === RENDER_UI_TOOL) {
              const spec = safeParse(args)?.spec as AgentUISpec | undefined;
              if (spec) {
                this.emit({
                  type: "agent_ui",
                  session_id: sessionId,
                  message_id: callId,
                  spec,
                  timestamp: new Date().toISOString(),
                });
              }
            } else {
              // Surface other tool runs as thought bubbles so the user sees
              // what the agent is doing.
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
            const callId = data.call_id ?? data.id ?? "";
            const pending = pendingCalls.get(callId);
            if (!pending) break;
            pendingCalls.delete(callId);

            if (pending.name !== RENDER_UI_TOOL) {
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
            break;
          }

          case "run.completed": {
            flushPending();
            if (assistantBuffer) {
              this.emit({
                type: "agent_message",
                session_id: sessionId,
                message_id: assistantMessageId,
                kind: "message",
                content: assistantBuffer,
                streaming: false,
                timestamp: new Date().toISOString(),
              });
            }
            this.emit({
              type: "session_status",
              session_id: sessionId,
              status: "done",
            });
            assistantBuffer = "";
            assistantMessageId = `agent-${Date.now()}`;
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
      flushPending();
      this.activeStreams.delete(ctrl);
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
  updated_at?: string;
  last_updated?: string;
}

interface HermesHistoryItem {
  id?: string;
  message_id?: string;
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  text?: string;
  kind?: string;
  created_at?: string;
  timestamp?: string;
}

function toSessionMeta(s: HermesSession): SessionMeta {
  const id = s.session_id ?? s.id ?? "";
  return {
    session_id: id,
    label: s.title ?? s.label ?? "Untitled",
    // A session fetched from the list is at rest, not actively running. Only a
    // live turn (streamChat) flips it to "active"; run.completed flips it back.
    // Defaulting to "active" made every session animate "thinking" forever.
    status: normaliseStatus(s.status),
    last_message: s.last_message ?? s.preview ?? "",
    last_updated: s.updated_at ?? s.last_updated ?? new Date().toISOString(),
    unread: 0,
  };
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

function toMessage(sessionId: string, m: HermesHistoryItem): Message {
  let content = "";
  if (typeof m.content === "string") content = m.content;
  else if (Array.isArray(m.content)) {
    content = m.content
      .map((c) => (c.type === "text" || c.type === "output_text" ? c.text ?? "" : ""))
      .join("");
  } else if (m.text) {
    content = m.text;
  }

  return {
    id: m.message_id ?? m.id ?? `msg-${Math.random()}`,
    session_id: sessionId,
    role: m.role === "user" ? "user" : "agent",
    kind: m.kind === "thought" ? "thought" : "message",
    content,
    timestamp: m.created_at ?? m.timestamp ?? new Date().toISOString(),
  };
}

// ── SSE parser ──────────────────────────────────────────────────────────────

interface SSEEvent {
  event: string;
  data: Record<string, unknown> & { delta?: string; text?: string; name?: string; tool_name?: string; call_id?: string; id?: string; arguments?: unknown; input?: unknown };
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
