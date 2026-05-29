import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../store";
import { SessionList } from "./sessions/SessionList";
import { ChatThread } from "./chat/ChatThread";
import { ConnectionBar } from "./ConnectionBar";
import { AddToHomeScreen } from "./AddToHomeScreen";

function ChatPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white">
      <p
        className="text-[#a0a3ad]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 500 }}
      >
        Select a task or start a new one.
      </p>
    </div>
  );
}

export function Layout() {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  return (
    <div className="flex flex-col h-svh overflow-hidden bg-white">
      <ConnectionBar />
      {/* ── Mobile ── */}
      <div className="flex flex-col w-full flex-1 min-h-0 md:hidden">
        {activeSessionId === null ? (
          <SessionList />
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <button
              onClick={() => setActiveSession(null)}
              aria-label="Back to chats"
              className="flex items-center gap-2 px-4 py-3 text-[#3B82F6] shrink-0"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 600 }}
            >
              <ArrowLeft size={18} />
              Chats
            </button>
            <div className="flex-1 min-h-0">
              <ChatThread sessionId={activeSessionId} />
            </div>
          </div>
        )}
        <AddToHomeScreen />
      </div>

      {/* ── Desktop ── */}
      <div className="hidden md:flex w-full flex-1 min-h-0">
        <SessionList />
        <main className="flex flex-1 flex-col min-w-0">
          {activeSessionId === null ? (
            <ChatPlaceholder />
          ) : (
            <ChatThread sessionId={activeSessionId} />
          )}
        </main>
      </div>
    </div>
  );
}
