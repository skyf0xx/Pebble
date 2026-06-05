import { useEffect } from "react";
import { useAppStore } from "../store";

// Deep-linkable chat URLs, hash-based. The browser URL carries the open session
// as `#/session/<id>`; refresh, back/forward, and a shared link all land on the
// same chat. Hash routing is deliberate over path routing: the launcher never
// sees the fragment, so there's nothing to configure server-side and no risk of
// shadowing `/api/`. The session list is just the bare origin (no hash).
//
// `activeSessionId` in the store is the single source of truth for which view is
// shown; this hook keeps the URL a mirror of it, both ways.

const SESSION_PREFIX = "#/session/";

// The new-chat sentinel (SessionList sets activeSessionId to this before the
// real id exists). It has no stable URL — a half-created chat isn't a place you
// can link back to — so we never write it to the hash.
const PENDING_SENTINEL = "__pending__";

/** Read a session id out of the current location hash, or null for the list. */
function sessionIdFromHash(): string | null {
  const hash = window.location.hash;
  // Ignore the #connect= deep-link (consumed at boot in main.tsx) — it isn't a
  // route, and decoding it here would yield a garbage "session id".
  if (hash.startsWith("#connect=") || hash.startsWith("#&connect=")) return null;
  if (!hash.startsWith(SESSION_PREFIX)) return null;
  const id = decodeURIComponent(hash.slice(SESSION_PREFIX.length));
  return id || null;
}

/** The hash string a given active session should produce. */
function hashForSession(sessionId: string | null): string {
  if (!sessionId || sessionId === PENDING_SENTINEL) return "";
  return `${SESSION_PREFIX}${encodeURIComponent(sessionId)}`;
}

export function useHashRoute() {
  useEffect(() => {
    const store = useAppStore.getState();

    // 1. Seed the active session from the URL on mount, so a deep-linked
    //    `#/session/abc` opens that chat instead of the inbox.
    const initial = sessionIdFromHash();
    if (initial && initial !== store.activeSessionId) {
      store.setActiveSession(initial);
    }

    // 2. URL → store: back/forward and manual edits update the active session.
    const onHashChange = () => {
      const id = sessionIdFromHash();
      if (id !== useAppStore.getState().activeSessionId) {
        useAppStore.getState().setActiveSession(id);
      }
    };
    window.addEventListener("hashchange", onHashChange);

    // 3. store → URL: opening/closing a chat in the app updates the hash. Use
    //    pushState so back/forward walks the history of opened chats; replace
    //    only the hash so the #connect= scrub in main.tsx isn't disturbed.
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.activeSessionId === prev.activeSessionId) return;
      const want = hashForSession(state.activeSessionId);
      const current = window.location.hash;
      // Normalise: an empty want means "no hash" (the bare list URL).
      if ((want || "") === (current || "")) return;
      const url = `${window.location.pathname}${window.location.search}${want}`;
      window.history.pushState(null, "", url);
    });

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      unsub();
    };
  }, []);
}
