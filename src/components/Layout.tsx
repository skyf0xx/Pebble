import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../store";
import { SessionList } from "./sessions/SessionList";

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

interface LayoutProps {
  children?: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  return (
    <div className="flex h-svh overflow-hidden bg-white">
      {/* ── Mobile ── */}
      <div className="flex flex-col w-full md:hidden">
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
              {children ?? <ChatPlaceholder />}
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop ── */}
      <div className="hidden md:flex w-full">
        <SessionList />
        <main className="flex flex-1 flex-col min-w-0">
          {activeSessionId === null || !children ? (
            <ChatPlaceholder />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
