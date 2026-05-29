import { WebSocketServer, WebSocket } from "ws";
import { state } from "./state.js";
import type { AgentMessage, ClientMessage } from "./types.js";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

function broadcast(msg: AgentMessage): void {
  const payload = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

export function startWsServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({ port });

    wss.on("listening", () => resolve());
    wss.on("error", reject);

    wss.on("connection", (ws) => {
      clients.add(ws);

      // Greet with current session list so the freshly-connected client hydrates.
      const greet: AgentMessage = { type: "session_list", sessions: state.list() };
      ws.send(JSON.stringify(greet));

      ws.on("message", (data) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(data.toString()) as ClientMessage;
        } catch {
          return;
        }
        handleClientMessage(ws, msg);
      });

      ws.on("close", () => {
        clients.delete(ws);
      });
    });

    // Wire state events to broadcasts. session_changed → push updated list to all.
    state.on("session_changed", () => {
      broadcast({ type: "session_list", sessions: state.list() });
    });

    state.on("broadcast", (msg: AgentMessage) => {
      broadcast(msg);
    });
  });
}

function handleClientMessage(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case "ping":
      ws.send(JSON.stringify({ type: "pong" } satisfies AgentMessage));
      return;

    case "session_create": {
      const meta = state.createSession(msg.label);
      // session_changed handler will broadcast the new list to everyone.
      // The MCP layer also gets notified.
      state.ingestClientMessage(msg);
      // Echo back to the creator so they know which session_id is theirs.
      ws.send(
        JSON.stringify({
          type: "session_status",
          session_id: meta.session_id,
          status: meta.status,
          label: meta.label,
        } satisfies AgentMessage),
      );
      return;
    }

    case "session_resume": {
      const s = state.get(msg.session_id);
      if (!s) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "session_not_found",
            message: `No session ${msg.session_id}`,
            session_id: msg.session_id,
          } satisfies AgentMessage),
        );
        return;
      }
      ws.send(
        JSON.stringify({
          type: "session_history",
          session_id: msg.session_id,
          messages: s.messages,
        } satisfies AgentMessage),
      );
      state.ingestClientMessage(msg);
      return;
    }

    case "session_delete": {
      state.deleteSession(msg.session_id);
      state.ingestClientMessage(msg);
      broadcast({ type: "session_list", sessions: state.list() });
      return;
    }

    case "user_message":
    case "ui_action":
      // Persist user_messages so they're visible in history on reconnect.
      if (msg.type === "user_message") {
        state.appendMessage(msg.session_id, {
          id: `user-${Date.now()}`,
          session_id: msg.session_id,
          role: "user",
          kind: "message",
          content: msg.content,
          timestamp: msg.timestamp,
        });
      }
      state.ingestClientMessage(msg);
      return;
  }
}

export function stopWsServer(): Promise<void> {
  return new Promise((resolve) => {
    for (const c of clients) {
      try {
        c.close();
      } catch {
        // ignore
      }
    }
    clients.clear();
    if (!wss) return resolve();
    wss.close(() => {
      wss = null;
      resolve();
    });
  });
}
