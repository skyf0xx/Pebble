#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

import { state } from "./state.js";
import { startWsServer, stopWsServer } from "./ws-server.js";
import { startHttpServer, stopHttpServer } from "./http-server.js";
import { startTunnel, stopAllTunnels } from "./tunnel.js";
import type { AgentMessage, ClientMessage, SessionStatus } from "./types.js";

const HTTP_PORT = Number(process.env.PEBBLE_HTTP_PORT ?? 3000);
const WS_PORT = Number(process.env.PEBBLE_WS_PORT ?? 3001);

interface RunningState {
  tunnelUrl: string;
  launchUrl: string;
  wsUrl: string;
}

let running: RunningState | null = null;

function deriveUrls(tunnelUrl: string): RunningState {
  // The tunnel points at the HTTP server. The PWA reads ?ws=... from the URL,
  // so we hand it back its own tunnel URL converted to wss://.
  const wsUrl = tunnelUrl.replace(/^https:/, "wss:");
  const launchUrl = `${tunnelUrl}/?ws=${encodeURIComponent(wsUrl)}`;
  return { tunnelUrl, wsUrl, launchUrl };
}

function ok<T extends object>(data: T): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function broadcast(msg: AgentMessage): void {
  state.emit("broadcast", msg);
}

const server = new McpServer({
  name: "pebble",
  version: "0.1.0",
});

// mcp/dist/index.js → repo root is two levels up; skills live at <root>/skills.
const SKILLS_DIR = resolve(fileURLToPath(import.meta.url), "..", "..", "..", "skills");

server.registerResource(
  "generative-ui-skill",
  "pebble://skills/generative-ui",
  {
    title: "Pebble generative UI reference",
    description:
      "Required reading before calling pebble_push_ui. Defines the json-render spec format, available components, action bindings, and style/intent rules.",
    mimeType: "text/markdown",
  },
  async (uri) => {
    const text = await readFile(join(SKILLS_DIR, "generative-ui.md"), "utf8");
    return {
      contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
    };
  },
);

server.registerTool(
  "pebble_start",
  {
    description:
      "Boot the Pebble HTTP server (:3000), WebSocket server (:3001), and a cloudflared tunnel. Returns { tunnel_url, ws_url, launch_url, qr_url }. After this call returns, immediately send `launch_url` to the user as a clickable link — that is the only URL they need to open Pebble (it already has the WebSocket query param baked in). If the user is on mobile, also render `qr_url` (an image) so they can scan instead of type. Do not send `tunnel_url` or `ws_url` to the user; those are internal.",
    inputSchema: {},
  },
  async () => {
    if (running) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        running.launchUrl,
      )}`;
      return ok({ ...running, qr_url: qrUrl, already_running: true });
    }
    await startHttpServer(HTTP_PORT);
    await startWsServer(WS_PORT);
    const tunnel = await startTunnel(HTTP_PORT);
    running = deriveUrls(tunnel.url);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      running.launchUrl,
    )}`;
    return ok({
      tunnel_url: running.tunnelUrl,
      ws_url: running.wsUrl,
      launch_url: running.launchUrl,
      qr_url: qrUrl,
    });
  },
);

server.registerTool(
  "pebble_stop",
  {
    description: "Shut down the HTTP server, WS server, and cloudflared tunnel.",
    inputSchema: {},
  },
  async () => {
    await stopAllTunnels();
    await stopWsServer();
    await stopHttpServer();
    running = null;
    return ok({ stopped: true });
  },
);

server.registerTool(
  "pebble_push_message",
  {
    description:
      "Send an agent_message (text bubble) to a session. Use kind='thought' for inner reasoning and kind='message' for the final answer.",
    inputSchema: {
      session_id: z.string(),
      content: z.string(),
      kind: z.enum(["thought", "message"]).default("message"),
    },
  },
  async ({ session_id, content, kind }) => {
    const message_id = randomUUID();
    const timestamp = new Date().toISOString();
    const k = kind ?? "message";
    state.appendMessage(session_id, {
      id: message_id,
      session_id,
      role: "agent",
      kind: k,
      content,
      timestamp,
      streaming: false,
    });
    broadcast({
      type: "agent_message",
      session_id,
      message_id,
      kind: k,
      content,
      streaming: false,
      timestamp,
    });
    return ok({ message_id });
  },
);

server.registerTool(
  "pebble_push_ui",
  {
    description:
      "Push an interactive json-render UI spec to a session. The user's interaction will come back as a ui_action you can await with pebble_wait_for_input. Before constructing your first spec, read the resource 'pebble://skills/generative-ui' (or ~/.pebble/skills/generative-ui.md) — it defines the spec format, the component catalogue, and the style/intent rules. Sending an invalid spec will render as a broken card.",
    inputSchema: {
      session_id: z.string(),
      spec: z.record(z.string(), z.unknown()),
    },
  },
  async ({ session_id, spec }) => {
    const message_id = randomUUID();
    const timestamp = new Date().toISOString();
    state.appendMessage(session_id, {
      id: message_id,
      session_id,
      role: "agent",
      kind: "message",
      content: "",
      timestamp,
      uiSpec: spec,
    });
    broadcast({
      type: "agent_ui",
      session_id,
      message_id,
      spec,
      timestamp,
    });
    return ok({ message_id });
  },
);

server.registerTool(
  "pebble_set_status",
  {
    description:
      "Update a session's status. Use 'active' while you're working, 'waiting' when the user needs to respond, 'done' when finished, 'error' if it failed.",
    inputSchema: {
      session_id: z.string(),
      status: z.enum(["active", "waiting", "done", "error"]),
      label: z.string().optional(),
    },
  },
  async ({ session_id, status, label }) => {
    const meta = state.setStatus(session_id, status as SessionStatus, label);
    if (!meta) {
      return ok({ error: "session_not_found", session_id });
    }
    broadcast({
      type: "session_status",
      session_id,
      status: meta.status,
      ...(label !== undefined ? { label } : {}),
    });
    return ok({ session_id, status: meta.status, label: meta.label });
  },
);

server.registerTool(
  "pebble_get_sessions",
  {
    description: "List all current sessions with their metadata, sorted by last_updated.",
    inputSchema: {},
  },
  async () => ok({ sessions: state.list() }),
);

server.registerTool(
  "pebble_wait_for_input",
  {
    description:
      "Block until the user sends a user_message or fires a ui_action in the given session. Returns the input, or { timed_out: true } if timeout_ms elapses.",
    inputSchema: {
      session_id: z.string(),
      timeout_ms: z.number().int().positive().optional(),
    },
  },
  async ({ session_id, timeout_ms }) => {
    const result = await new Promise<object>((resolve) => {
      const onMsg = (msg: ClientMessage) => {
        if (
          (msg.type === "user_message" || msg.type === "ui_action") &&
          msg.session_id === session_id
        ) {
          cleanup();
          if (msg.type === "user_message") {
            resolve({ type: "user_message", content: msg.content, timestamp: msg.timestamp });
          } else {
            resolve({
              type: "ui_action",
              action: msg.action,
              payload: msg.payload,
              timestamp: msg.timestamp,
            });
          }
        }
      };
      const cleanup = () => {
        state.off("client_message", onMsg);
        if (timer) clearTimeout(timer);
      };
      const timer = timeout_ms
        ? setTimeout(() => {
            cleanup();
            resolve({ timed_out: true });
          }, timeout_ms)
        : null;
      state.on("client_message", onMsg);
    });
    return ok(result);
  },
);

async function shutdown(): Promise<void> {
  try {
    await stopAllTunnels();
  } catch {
    // ignore
  }
  try {
    await stopWsServer();
  } catch {
    // ignore
  }
  try {
    await stopHttpServer();
  } catch {
    // ignore
  }
}

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});

const transport = new StdioServerTransport();
await server.connect(transport);
