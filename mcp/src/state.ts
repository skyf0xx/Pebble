import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { ClientMessage, Message, SessionMeta, SessionStatus } from "./types.js";

// Single in-memory store shared between the WS server (browser-facing)
// and the MCP server (agent-facing). Both run in the same Node process.
//
// Events:
//   "client_message" — payload: ClientMessage. Anything a browser sent.
//   "session_changed" — payload: SessionMeta. State mutation worth broadcasting.
//   "broadcast" — payload: AgentMessage. Re-broadcast to all browser clients.

export interface SessionState {
  meta: SessionMeta;
  messages: Message[];
}

export class PebbleState extends EventEmitter {
  private sessions = new Map<string, SessionState>();

  list(): SessionMeta[] {
    return [...this.sessions.values()]
      .map((s) => s.meta)
      .sort(
        (a, b) =>
          new Date(b.last_updated).getTime() -
          new Date(a.last_updated).getTime(),
      );
  }

  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  createSession(label?: string): SessionMeta {
    const session_id = randomUUID();
    const now = new Date().toISOString();
    const meta: SessionMeta = {
      session_id,
      label: label ?? "New chat",
      status: "active",
      last_message: "",
      last_updated: now,
      unread: 0,
    };
    this.sessions.set(session_id, { meta, messages: [] });
    this.emit("session_changed", meta);
    return meta;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  appendMessage(sessionId: string, msg: Message): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    // Replace by id (streaming chunks share an id) or append.
    const idx = s.messages.findIndex((m) => m.id === msg.id);
    if (idx >= 0) s.messages[idx] = msg;
    else s.messages.push(msg);
    s.meta.last_message = msg.content || s.meta.last_message;
    s.meta.last_updated = msg.timestamp;
    this.emit("session_changed", s.meta);
  }

  setStatus(sessionId: string, status: SessionStatus, label?: string): SessionMeta | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    s.meta.status = status;
    if (label !== undefined) s.meta.label = label;
    s.meta.last_updated = new Date().toISOString();
    this.emit("session_changed", s.meta);
    return s.meta;
  }

  // Called by ws-server when a browser sends a frame. Re-emits as a typed event
  // so the MCP layer (and pebble_wait_for_input) can react.
  ingestClientMessage(msg: ClientMessage): void {
    this.emit("client_message", msg);
  }
}

export const state = new PebbleState();
