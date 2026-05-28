import { openDB } from "idb";
import type { SessionMeta, Message } from "../types";

const SESSIONS_KEY = "pebble_sessions";
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

export async function loadMessages(sessionId: string): Promise<Message[]> {
  const db = await getDB();
  return (await db.get(MESSAGES_STORE, sessionId)) ?? [];
}

export async function saveMessages(sessionId: string, messages: Message[]): Promise<void> {
  const db = await getDB();
  await db.put(MESSAGES_STORE, messages, sessionId);
}
