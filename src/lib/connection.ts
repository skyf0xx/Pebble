import { useAppStore } from "../store";
import type { AgentMessage, ClientMessage } from "../types";
import type { HostAdapter } from "./adapters/types";
import { HermesAdapter } from "./adapters/hermes";

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
      if (store.pendingSession) {
        const oldIds = new Set(store.sessions.map((s) => s.session_id));
        const newSession = msg.sessions.find((s) => !oldIds.has(s.session_id));
        store.setSessions(msg.sessions);
        if (newSession) {
          store.setPendingSession(false);
          store.setActiveSession(newSession.session_id);
        }
      } else {
        store.setSessions(msg.sessions);
      }
      break;
    }

    case "session_status": {
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
