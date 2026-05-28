import { create } from "zustand";
import type { SessionMeta, Message } from "../types";

export type WsStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

interface AppState {
  wsUrl: string | null;
  wsStatus: WsStatus;
  sessions: SessionMeta[];
  activeSessionId: string | null;
  messages: Record<string, Message[]>;

  setWsUrl: (url: string | null) => void;
  setWsStatus: (status: WsStatus) => void;
  setSessions: (sessions: SessionMeta[]) => void;
  upsertSession: (session: SessionMeta) => void;
  setActiveSession: (sessionId: string | null) => void;
  appendMessage: (sessionId: string, message: Message) => void;
  upsertMessage: (sessionId: string, message: Message) => void;
}

export const useAppStore = create<AppState>((set) => ({
  wsUrl: null,
  wsStatus: "disconnected",
  sessions: [],
  activeSessionId: null,
  messages: {},

  setWsUrl: (url) => set({ wsUrl: url }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setSessions: (sessions) => set({ sessions }),
  upsertSession: (session) =>
    set((state) => {
      const idx = state.sessions.findIndex(
        (s) => s.session_id === session.session_id
      );
      const sessions =
        idx >= 0
          ? state.sessions.map((s, i) => (i === idx ? session : s))
          : [...state.sessions, session];
      return { sessions };
    }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  appendMessage: (sessionId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] ?? []), message],
      },
    })),
  upsertMessage: (sessionId, message) =>
    set((state) => {
      const existing = state.messages[sessionId] ?? [];
      const idx = existing.findIndex((m) => m.id === message.id);
      const updated =
        idx >= 0
          ? existing.map((m, i) => (i === idx ? message : m))
          : [...existing, message];
      return { messages: { ...state.messages, [sessionId]: updated } };
    }),
}));
