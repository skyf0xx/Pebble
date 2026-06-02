import { useAppStore, isUnnamed } from "../store";
import type { AgentMessage, ClientMessage } from "../types";
import type { HostAdapter } from "./adapters/types";
import { HermesAdapter, isPebbleOwned } from "./adapters/hermes";
import { saveConnectionConfig } from "./storage";

export { testConnection } from "./adapters/hermes";
export type { TestResult } from "./adapters/hermes";

/**
 * What the launcher's `GET /api/connect-info` reports about reaching this
 * Pebble from another device. `tunnelUrl` is the `https://<host>.ts.net` address
 * a `tailscale serve` is exposing this launcher on, or null when no tunnel is
 * up. The "Open on phone" flow branches on it: a URL → show the QR; null → walk
 * the user through the Tailscale setup wizard.
 */
export interface ConnectInfo {
  tunnelUrl: string | null;
}

/**
 * Ask the launcher whether a Tailscale tunnel is currently exposing it. Returns
 * `{ tunnelUrl: null }` on any failure (endpoint missing — e.g. an older
 * launcher — network error, or no tunnel), so callers can always fall back to
 * the wizard. The endpoint is same-origin (the launcher serves it directly,
 * ahead of the Hermes proxy), so no config is needed.
 */
export async function fetchConnectInfo(): Promise<ConnectInfo> {
  try {
    const res = await fetch("/api/connect-info", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { tunnelUrl: null };
    const data = (await res.json()) as Partial<ConnectInfo>;
    return { tunnelUrl: data.tunnelUrl ?? null };
  } catch {
    return { tunnelUrl: null };
  }
}

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
 * The launcher serves both the app and the proxied Hermes API from the same
 * origin Pebble loads from — whether that's `http://localhost:5173` on the
 * desktop machine or `https://<host>.ts.net` when reached over Tailscale. Either
 * way the origin *is* the agent URL, so we can connect with no paste and no
 * wizard. This is the default path on every device:
 *   - Desktop: the launcher's localhost origin → straight into the chat.
 *   - Phone over the tunnel: the .ts.net origin → same.
 * Tailscale is now only needed to *reach* Pebble from another device — not to
 * use it locally. Returns the origin to verify and connect.
 *
 * (The `?mock` dev case and any future non-launcher host would still fail
 * verification and fall through; that's fine — verification gates this.)
 */
export function originConnectCandidate(): ConnectionConfig | null {
  return { hermes: normalizeBaseUrl(window.location.origin) };
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
 *
 * The link's base must be an address the *phone* can reach — the
 * `https://<host>.ts.net` tunnel URL, never `localhost`. On desktop the running
 * config is localhost, so callers pass the tunnel URL (from fetchConnectInfo())
 * explicitly as `tunnelUrl`; when omitted we fall back to the config URL (the
 * already-on-.ts.net case, where the config *is* the tunnel URL).
 */
export function buildConnectLink(config: ConnectionConfig, tunnelUrl?: string): string {
  const base = normalizeBaseUrl(tunnelUrl ?? config.hermes);
  // The phone connects to the same tunnel origin it loads Pebble from, so the
  // embedded config points at that tunnel URL too.
  const payload = btoa(JSON.stringify({ hermes: base }));
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

export function connect(config: ConnectionConfig) {
  if (adapter) disconnect();
  adapter = new HermesAdapter({ baseUrl: config.hermes });
  adapter.onEvent(dispatch);
  adapter.onStatus((status) => {
    useAppStore.getState().setWsStatus(status);
  });
  void adapter.connect();
}

// Silent reminder appended to a user turn when a conversation is established
// but the agent still hasn't named the session. Agents reliably set a label
// when asked but often skip it unprompted — and sometimes ignore the first
// reminder too. By the 3rd turn there's enough context for a *good* title, so
// we re-attach the reminder on each turn in a small window (until the agent
// complies) rather than nudging exactly once. It rides along on the existing
// turn — costs no extra round-trip — and is never shown in the thread (InputBar
// appends the raw content to the UI separately).
const LABEL_REMINDER =
  "\n\n[Pebble] This chat still has no title. Send a pebble_send now with a " +
  "short (2–4 word) `label` that captures what this conversation is about, so " +
  "it reads well in the session list. Set only the label; keep replying normally.";

// User-turn window (counting the just-sent one) over which we keep re-attaching
// the reminder while the session is still unnamed. Bounded so a non-compliant
// agent can't pollute every turn forever — the provisional title stays as-is.
const LABEL_REMINDER_FIRST_TURN = 3;
const LABEL_REMINDER_LAST_TURN = 6;

/** True when the agent hasn't set a real, final title for this session yet. */
function sessionNeedsLabel(sessionId: string): boolean {
  const session = useAppStore
    .getState()
    .sessions.find((s) => s.session_id === sessionId);
  // labelProvisional === false means an explicit agent/user title is locked in.
  return !session || session.labelProvisional !== false;
}

/** Count of user-authored messages in a session (the just-appended one included). */
function userTurnCount(sessionId: string): number {
  const messages = useAppStore.getState().messages[sessionId] ?? [];
  return messages.filter((m) => m.role === "user").length;
}

export function send(msg: ClientMessage) {
  // While a chat is still untitled, append the reminder on each user turn in the
  // [first, last] window so the agent names it — re-nudging if it ignored an
  // earlier one, but capped so it can't ride every turn forever. Only real user
  // messages (not ui_action turns) count toward the turn number.
  if (msg.type === "user_message") {
    const turn = userTurnCount(msg.session_id);
    const needsLabel = sessionNeedsLabel(msg.session_id);
    console.debug(
      "[pebble] label-reminder gate",
      { turn, needsLabel, session: msg.session_id },
    );
    if (
      turn >= LABEL_REMINDER_FIRST_TURN &&
      turn <= LABEL_REMINDER_LAST_TURN &&
      needsLabel
    ) {
      console.debug("[pebble] appending LABEL_REMINDER");
      adapter?.send({ ...msg, content: msg.content + LABEL_REMINDER });
      return;
    }
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
      // Ownership is now server-derived: a session is Pebble's iff its title
      // carries the [pebble] prefix. Hermes may host many others (other clients,
      // cron jobs, etc.) that aren't ours to display. This makes the list sync
      // across devices — any device sees every [pebble] session, not just ones
      // it created locally.
      // Merge, don't replace: a wholesale setSessions would clobber a good local
      // label (e.g. an in-progress provisional title) on every reconnect.
      store.mergeSessions(
        msg.sessions.filter((s) => isPebbleOwned(s.label)),
      );
      break;
    }

    case "session_status": {
      const existing = store.sessions.find((s) => s.session_id === msg.session_id);
      // A status for a session we don't yet know, while we're awaiting a freshly
      // created one, is that new session — the adapter emits it (with its real
      // id) right after creating it. Focus it as the active chat.
      if (!existing) {
        if (!store.pendingSession) break; // unrelated session — ignore
        store.setPendingSession(false);
        store.setActiveSession(msg.session_id);
        // Mark this id as the in-flight create so the list refresh that fires
        // right after createSession() can't drop it before Hermes indexes it.
        store.setPendingCreateId(msg.session_id);
      }
      // The create-time status carries the "[pebble][…] New chat" placeholder,
      // which is NOT a real title — isUnnamed() sees through the tag and treats
      // it as unnamed, so we keep the session provisional. That lets the label
      // reminder fire and the user's first message rename it. Only a genuine
      // agent/user label (not unnamed) locks labelProvisional to false.
      const labelIsFinal = !!msg.label && !isUnnamed(msg.label);
      store.upsertSession({
        session_id: msg.session_id,
        label: msg.label ?? existing?.label ?? "Untitled",
        // An explicit agent label is final — clear the provisional flag so it's
        // never auto-overwritten by a later derived title. Otherwise keep the
        // existing provenance.
        labelProvisional: labelIsFinal ? false : existing?.labelProvisional ?? true,
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
        // Upgrade a still-provisional title from the agent's reply. Agents often
        // omit the explicit `label`, so deriving from this first real response
        // beats leaving the raw user message as the title. No-op once the title
        // is final (explicit agent label / user edit).
        store.nameSessionFromAgent(msg.session_id, msg.content);
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
