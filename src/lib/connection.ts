import { useAppStore } from "../store";
import type { AgentMessage, ClientMessage } from "../types";
import type { HostAdapter } from "./adapters/types";
import { HermesAdapter } from "./adapters/hermes";
import {
  loadOwnedSessionIds,
  addOwnedSessionId,
  removeOwnedSessionId,
  saveConnectionConfig,
  clearConnectionConfig,
} from "./storage";

export { testConnection } from "./adapters/hermes";
export type { TestResult } from "./adapters/hermes";

let adapter: HostAdapter | null = null;

export interface ConnectionConfig {
  /** Tailscale Serve base URL, e.g. https://host.ts.net. No trailing slash. */
  hermes: string;
}

/** Strip a trailing slash so `${base}/api/...` never double-slashes. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Persist the verified connection and bring Pebble online with it. Called by the
 * setup wizard once testConnection() has passed. Saving + setting store state in
 * one place keeps the "connect" path single-sourced.
 */
export function saveAndConnect(config: ConnectionConfig) {
  const normalized: ConnectionConfig = {
    hermes: normalizeBaseUrl(config.hermes),
  };
  saveConnectionConfig(normalized);
  const store = useAppStore.getState();
  store.setWsUrl(normalized.hermes);
  store.setConnectionConfig(normalized);
}

/**
 * Build a deep-link that carries the connection so a second device (phone) can
 * scan a QR and auto-connect. The base is the configured agent URL — *not*
 * window.location — because the launcher serves the app and the API from the
 * same origin: when that origin is the Tailscale `https://<host>.ts.net` URL,
 * the phone can both load Pebble and reach the agent from it. (Basing the link
 * on window.location would hand the phone a `localhost:5173` it can't open.)
 * The config rides in the URL *fragment*, never the query string, so it's never
 * sent to a server or written to access logs. consumeConnectLink() reads it on
 * boot and scrubs it from the URL immediately after.
 */
export function buildConnectLink(config: ConnectionConfig): string {
  const payload = btoa(JSON.stringify({ hermes: config.hermes }));
  const base = normalizeBaseUrl(config.hermes);
  return `${base}/#connect=${encodeURIComponent(payload)}`;
}

/**
 * If the current URL carries a #connect= deep-link (from a scanned QR), decode
 * it and strip it from the address bar. Returns the config for the caller to
 * verify before saving — we never trust a link blindly. Returns null when
 * there's no link or it's malformed.
 */
export function consumeConnectLink(): ConnectionConfig | null {
  const hash = window.location.hash;
  const match = /[#&]connect=([^&]+)/.exec(hash);
  if (!match) return null;

  // Scrub immediately, whether or not decoding succeeds — a bad link shouldn't
  // sit in the URL either.
  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", cleanUrl);

  try {
    const decoded = JSON.parse(atob(decodeURIComponent(match[1]))) as Partial<ConnectionConfig>;
    if (!decoded.hermes) return null;
    return { hermes: decoded.hermes };
  } catch {
    return null;
  }
}

/**
 * Forget the saved connection and return to the setup wizard. Sessions/messages
 * stay in localStorage/IndexedDB; only the link is dropped.
 */
export function forgetConnection() {
  disconnect();
  clearConnectionConfig();
  const store = useAppStore.getState();
  store.setConnectionConfig(null);
  store.setWsUrl(null);
}

export function connect(config: ConnectionConfig) {
  if (adapter) disconnect();
  adapter = new HermesAdapter({ baseUrl: config.hermes });
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
