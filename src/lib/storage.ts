import { openDB } from "idb";
import type { SessionMeta, Message } from "../types";
import type { ConnectionConfig } from "./connection";

const SESSIONS_KEY = "pebble_sessions";
const OWNED_KEY = "pebble_owned_sessions";
const CONFIG_KEY = "pebble_connection";
const DB_NAME = "pebble";
const DB_VERSION = 1;
const MESSAGES_STORE = "pebble_messages";

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        db.createObjectStore(MESSAGES_STORE);
      }
    },
  });
}

export function loadSessions(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as SessionMeta[]) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: SessionMeta[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

/**
 * The Tailscale connection (base URL) the user set up once in the setup wizard.
 * Persisted to localStorage so Pebble reconnects automatically on every launch
 * — no link to paste again, no URL params. This is the only way in.
 */
export function loadConnectionConfig(): ConnectionConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConnectionConfig>;
    if (!parsed.hermes) return null;
    return { hermes: parsed.hermes };
  } catch {
    return null;
  }
}

export function saveConnectionConfig(config: ConnectionConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearConnectionConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

/**
 * Pebble only surfaces sessions it started itself — the Hermes agent may have
 * many other sessions (from other clients, cron jobs, etc.) that aren't ours.
 * We persist the set of session IDs Pebble created and filter the list to them.
 */
export function loadOwnedSessionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function addOwnedSessionId(id: string): void {
  const ids = loadOwnedSessionIds();
  ids.add(id);
  localStorage.setItem(OWNED_KEY, JSON.stringify([...ids]));
}

export function removeOwnedSessionId(id: string): void {
  const ids = loadOwnedSessionIds();
  ids.delete(id);
  localStorage.setItem(OWNED_KEY, JSON.stringify([...ids]));
}

/**
 * One-time migration: before ownership tracking existed, Pebble persisted every
 * session it had seen. If the ownership key has never been written, seed it from
 * those persisted sessions so existing users don't lose their chat list.
 */
export function migrateOwnedSessionIds(): void {
  if (localStorage.getItem(OWNED_KEY) !== null) return;
  const ids = loadSessions().map((s) => s.session_id);
  localStorage.setItem(OWNED_KEY, JSON.stringify(ids));
}

export async function loadMessages(sessionId: string): Promise<Message[]> {
  const db = await getDB();
  return (await db.get(MESSAGES_STORE, sessionId)) ?? [];
}

export async function saveMessages(sessionId: string, messages: Message[]): Promise<void> {
  const db = await getDB();
  await db.put(MESSAGES_STORE, messages, sessionId);
}
