import { create } from "zustand";
import type { SessionMeta, Message } from "../types";
import type { ConnectionConfig } from "../lib/connection";
import {
  loadSessions,
  saveSessions,
  loadMessages,
  saveMessages,
} from "../lib/storage";

export type WsStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

// Placeholder a session carries until something names it. A session whose label
// is empty or this value is "unnamed" and eligible for a provisional title.
const UNNAMED_LABEL = "Untitled";

export function isUnnamed(label: string): boolean {
  const l = label.trim();
  return l === "" || l === UNNAMED_LABEL;
}

// Turn the user's first message into a short, human session title. Collapses
// whitespace and truncates at a word boundary so the row stays calm, not clipped
// mid-word. The agent can still override this later via a pebble_send label.
function deriveLabel(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 40) return clean;
  const cut = clean.slice(0, 40);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

interface AppState {
  wsUrl: string | null;
  wsStatus: WsStatus;
  connectionConfig: ConnectionConfig | null;
  sessions: SessionMeta[];
  activeSessionId: string | null;
  pendingSession: boolean;
  messages: Record<string, Message[]>;

  setWsUrl: (url: string | null) => void;
  setWsStatus: (status: WsStatus) => void;
  setConnectionConfig: (config: ConnectionConfig | null) => void;
  setPendingSession: (pending: boolean) => void;
  setSessions: (sessions: SessionMeta[]) => void;
  mergeSessions: (incoming: SessionMeta[]) => void;
  upsertSession: (session: SessionMeta) => void;
  setActiveSession: (sessionId: string | null) => void;
  nameSessionFromMessage: (sessionId: string, text: string) => void;
  nameSessionFromAgent: (sessionId: string, text: string) => void;
  incrementUnread: (sessionId: string) => void;
  clearUnread: (sessionId: string) => void;
  appendMessage: (sessionId: string, message: Message) => void;
  upsertMessage: (sessionId: string, message: Message) => void;
  loadMessagesForSession: (sessionId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  wsUrl: null,
  wsStatus: "disconnected",
  connectionConfig: null,
  sessions: loadSessions(),
  activeSessionId: null,
  pendingSession: false,
  messages: {},

  setWsUrl: (url) => set({ wsUrl: url }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setConnectionConfig: (config) => set({ connectionConfig: config }),
  setPendingSession: (pending) => set({ pendingSession: pending }),

  setSessions: (sessions) => {
    saveSessions(sessions);
    set({ sessions });
  },

  // Reconcile a server-provided session list with what we already hold. Hermes
  // doesn't persist the title we assign locally (the user-derived provisional
  // name, or the agent's pebble_send label), so a raw GET /api/sessions returns
  // "Untitled" for everything. Replacing wholesale would wipe a good local label
  // on every reconnect/refresh. So: take the server's list as the source of
  // truth for membership and freshness, but keep our local label and unread
  // count whenever the server has nothing better to offer.
  mergeSessions: (incoming) => {
    set((state) => {
      const prev = new Map(state.sessions.map((s) => [s.session_id, s]));
      const sessions = incoming.map((s) => {
        const existing = prev.get(s.session_id);
        if (!existing) return s;
        const serverHasTitle = !isUnnamed(s.label);
        return {
          ...s,
          // Server label only wins when it's a real title and ours isn't.
          label: serverHasTitle ? s.label : existing.label,
          labelProvisional: serverHasTitle ? false : existing.labelProvisional,
          unread: existing.unread,
        };
      });
      saveSessions(sessions);
      return { sessions };
    });
  },

  upsertSession: (session) => {
    set((state) => {
      const idx = state.sessions.findIndex(
        (s) => s.session_id === session.session_id
      );
      const sessions =
        idx >= 0
          ? state.sessions.map((s, i) => (i === idx ? session : s))
          : [...state.sessions, session];
      saveSessions(sessions);
      return { sessions };
    });
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
    if (sessionId) {
      const sessions = get().sessions.map((s) =>
        s.session_id === sessionId ? { ...s, unread: 0 } : s
      );
      saveSessions(sessions);
      set({ sessions });
    }
  },

  nameSessionFromMessage: (sessionId, text) => {
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.session_id === sessionId);
      // Only name a session that's still unnamed — never clobber an agent- or
      // user-given label. (The agent's pebble_send label still wins later, since
      // dispatch() prefers msg.label over the existing one.)
      if (idx < 0 || !isUnnamed(state.sessions[idx].label)) return state;
      const label = deriveLabel(text);
      if (!label) return state;
      const sessions = state.sessions.map((s, i) =>
        // Mark provisional: this is just a placeholder from the user's first
        // message. The agent's first reply (or an explicit label) may replace it.
        i === idx ? { ...s, label, labelProvisional: true } : s
      );
      saveSessions(sessions);
      return { sessions };
    });
  },

  // Upgrade a still-provisional title using the agent's first reply. Agents
  // routinely forget to set an explicit `label` (the protocol asks them to, but
  // it's a soft instruction), so the raw user message would otherwise stick.
  // Deriving from the agent's response gives a far better title — and stays
  // provisional, so a later explicit agent `label` can still replace it.
  nameSessionFromAgent: (sessionId, text) => {
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.session_id === sessionId);
      // Only touch a provisional (or empty) label — never an explicit one.
      if (idx < 0) return state;
      const current = state.sessions[idx];
      if (!current.labelProvisional && !isUnnamed(current.label)) return state;
      const label = deriveLabel(text);
      if (!label) return state;
      const sessions = state.sessions.map((s, i) =>
        i === idx ? { ...s, label, labelProvisional: true } : s
      );
      saveSessions(sessions);
      return { sessions };
    });
  },

  incrementUnread: (sessionId) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.session_id === sessionId ? { ...s, unread: s.unread + 1 } : s
      );
      saveSessions(sessions);
      return { sessions };
    });
  },

  clearUnread: (sessionId) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.session_id === sessionId ? { ...s, unread: 0 } : s
      );
      saveSessions(sessions);
      return { sessions };
    });
  },

  appendMessage: (sessionId, message) => {
    set((state) => {
      const updated = [...(state.messages[sessionId] ?? []), message];
      saveMessages(sessionId, updated);
      return { messages: { ...state.messages, [sessionId]: updated } };
    });
  },

  upsertMessage: (sessionId, message) => {
    set((state) => {
      const existing = state.messages[sessionId] ?? [];
      const idx = existing.findIndex((m) => m.id === message.id);
      const updated =
        idx >= 0
          ? existing.map((m, i) => (i === idx ? message : m))
          : [...existing, message];
      saveMessages(sessionId, updated);
      return { messages: { ...state.messages, [sessionId]: updated } };
    });
  },

  loadMessagesForSession: async (sessionId) => {
    const already = get().messages[sessionId];
    if (already && already.length > 0) return;
    const messages = await loadMessages(sessionId);
    set((state) => ({
      messages: { ...state.messages, [sessionId]: messages },
    }));
  },
}));
