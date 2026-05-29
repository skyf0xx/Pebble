import { useAppStore } from "../store";
import type { AgentMessage, ClientMessage } from "../types";
import type { HostAdapter } from "./adapters/types";
import { HermesAdapter } from "./adapters/hermes";
import {
  loadOwnedSessionIds,
  addOwnedSessionId,
  removeOwnedSessionId,
} from "./storage";

let adapter: HostAdapter | null = null;

export interface ConnectionConfig {
  hermes: string;
  token?: string;
}

export function pickConfig(search: string): ConnectionConfig | null {
  const params = new URLSearchParams(search);
  const hermes = params.get("hermes");
  if (!hermes) return null;
  const token = params.get("token") ?? undefined;
  return { hermes, token };
}

export function connect(config: ConnectionConfig) {
  if (adapter) disconnect();
  adapter = new HermesAdapter({ baseUrl: config.hermes, token: config.token });
  adapter.onEvent(dispatch);
  adapter.onStatus((status) => {
    useAppStore.getState().setWsStatus(status);
  });
  void adapter.connect();
}

export function send(msg: ClientMessage) {
  // Drop ownership the moment Pebble deletes a session, so the subsequent
  // session_list refresh doesn't re-add it.
  if (msg.type === "session_delete") {
    removeOwnedSessionId(msg.session_id);
  }
  adapter?.send(msg);
}

export function disconnect() {
  if (adapter) {
    adapter.disconnect();
    adapter = null;
  }
  useAppStore.getState().setWsStatus("disconnected");
}

function dispatch(msg: AgentMessage) {
  const store = useAppStore.getState();

  switch (msg.type) {
    case "session_list": {
      // Only show sessions Pebble started. Hermes may host many others
      // (other clients, cron jobs, etc.) that aren't ours to display.
      const owned = loadOwnedSessionIds();
      store.setSessions(msg.sessions.filter((s) => owned.has(s.session_id)));
      break;
    }

    case "session_status": {
      // A status for an unowned session while we're awaiting a freshly created
      // one is that new session — the adapter emits it (with its real id) right
      // after creating it. Claim ownership and make it the active chat.
      if (!loadOwnedSessionIds().has(msg.session_id)) {
        if (!store.pendingSession) break; // unrelated session — ignore
        addOwnedSessionId(msg.session_id);
        store.setPendingSession(false);
        store.setActiveSession(msg.session_id);
      }
      const existing = store.sessions.find((s) => s.session_id === msg.session_id);
      store.upsertSession({
        session_id: msg.session_id,
        label: msg.label ?? existing?.label ?? "Untitled",
        status: msg.status,
        last_message: existing?.last_message ?? "",
        last_updated: existing?.last_updated ?? new Date().toISOString(),
        unread: existing?.unread ?? 0,
      });
      break;
    }

    case "session_history":
      msg.messages.forEach((m) => store.upsertMessage(msg.session_id, m));
      break;

    case "agent_message": {
      store.upsertMessage(msg.session_id, {
        id: msg.message_id,
        session_id: msg.session_id,
        role: "agent",
        kind: msg.kind,
        content: msg.content,
        timestamp: msg.timestamp,
        streaming: msg.streaming,
      });
      // Keep the session row preview in sync with the agent's reply. Only the
      // final "message" (not thoughts, not partial chunks) updates the preview.
      if (msg.kind === "message" && !msg.streaming && msg.content) {
        const existing = store.sessions.find((s) => s.session_id === msg.session_id);
        if (existing) {
          store.upsertSession({
            ...existing,
            last_message: msg.content,
            last_updated: msg.timestamp,
          });
        }
      }
      if (msg.session_id !== store.activeSessionId && !msg.streaming) {
        store.incrementUnread(msg.session_id);
      }
      break;
    }

    case "agent_ui":
      store.upsertMessage(msg.session_id, {
        id: msg.message_id,
        session_id: msg.session_id,
        role: "agent",
        kind: "message",
        content: "",
        timestamp: msg.timestamp,
        streaming: false,
        uiSpec: msg.spec,
      });
      if (msg.session_id !== store.activeSessionId) {
        store.incrementUnread(msg.session_id);
      }
      break;

    case "error":
      console.error("[connection] agent error", msg.code, msg.message);
      break;
  }
}
