import ReconnectingWebSocket from "reconnecting-websocket";
import { useAppStore } from "../store";
import type { AgentMessage } from "../types";

let rws: ReconnectingWebSocket | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;

export function connect(url: string) {
  if (rws) disconnect();

  useAppStore.getState().setWsStatus("connecting");

  rws = new ReconnectingWebSocket(url, [], {
    minReconnectionDelay: 1000,
    maxReconnectionDelay: 30000,
    reconnectionDelayGrowFactor: 2,
    maxRetries: Infinity,
  });

  rws.addEventListener("open", () => {
    useAppStore.getState().setWsStatus("connected");

    pingInterval = setInterval(() => {
      send({ type: "ping" });
    }, 25_000);
  });

  rws.addEventListener("close", () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    useAppStore.getState().setWsStatus("reconnecting");
  });

  rws.addEventListener("message", (event: MessageEvent) => {
    let msg: AgentMessage;
    try {
      msg = JSON.parse(event.data as string) as AgentMessage;
    } catch {
      return;
    }
    dispatch(msg);
  });
}

export function send(msg: object) {
  if (!rws || rws.readyState !== ReconnectingWebSocket.OPEN) return;
  rws.send(JSON.stringify(msg));
}

export function disconnect() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (rws) {
    rws.close();
    rws = null;
  }
  useAppStore.getState().setWsStatus("disconnected");
}

function dispatch(msg: AgentMessage) {
  const store = useAppStore.getState();

  switch (msg.type) {
    case "session_list":
      store.setSessions(msg.sessions);
      break;

    case "session_status":
      store.upsertSession({
        // preserve existing fields, overlay status + optional label
        ...store.sessions.find((s) => s.session_id === msg.session_id)!,
        session_id: msg.session_id,
        status: msg.status,
        ...(msg.label !== undefined ? { label: msg.label } : {}),
      });
      break;

    case "session_history":
      msg.messages.forEach((m) => store.upsertMessage(msg.session_id, m));
      break;

    case "agent_message": {
      const message = {
        id: msg.message_id,
        session_id: msg.session_id,
        role: "agent" as const,
        kind: msg.kind,
        content: msg.content,
        timestamp: msg.timestamp,
        streaming: msg.streaming,
      };
      store.upsertMessage(msg.session_id, message);
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

    case "agent_push":
      // Global push notifications — stored against a synthetic session id or null session.
      // UI layer is responsible for rendering these; no store mutation needed here.
      break;

    case "pong":
      break;

    case "error":
      console.error("[ws] agent error", msg.code, msg.message);
      break;
  }
}
