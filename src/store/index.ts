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
  upsertSession: (session: SessionMeta) => void;
  setActiveSession: (sessionId: string | null) => void;
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
