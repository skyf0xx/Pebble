import { openDB } from "idb";
import type { Message } from "../types";
import type { ConnectionConfig } from "./connection";

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


export async function loadMessages(sessionId: string): Promise<Message[]> {
  const db = await getDB();
  return (await db.get(MESSAGES_STORE, sessionId)) ?? [];
}

export async function saveMessages(sessionId: string, messages: Message[]): Promise<void> {
  const db = await getDB();
  await db.put(MESSAGES_STORE, messages, sessionId);
}
