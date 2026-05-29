import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useAppStore } from "../store";
import { SessionList } from "./sessions/SessionList";
import { ChatThread } from "./chat/ChatThread";
import { ConnectionBar } from "./ConnectionBar";
import { AddToHomeScreen } from "./AddToHomeScreen";
import { useTheme } from "../lib/theme";

function ChatPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#1C1917]">
      <p
        className="text-[#a0a3ad] dark:text-[#78716c]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 500 }}
      >
        Select a task or start a new one.
      </p>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="p-2 rounded-full text-[#757780] hover:text-[#3B82F6] hover:bg-[#eff6ff] dark:text-[#A8A29E] dark:hover:text-[#F5F0EB] dark:hover:bg-[#2A2520] transition-colors duration-200"
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function Layout() {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  return (
    <div className="flex flex-col h-svh overflow-hidden bg-white dark:bg-[#1C1917]">
      <ConnectionBar />
      {/* ── Mobile ── */}
      <div className="flex flex-col w-full flex-1 min-h-0 md:hidden">
        {activeSessionId === null ? (
          <SessionList themeToggle={<ThemeToggle />} />
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
              <button
                onClick={() => setActiveSession(null)}
                aria-label="Back to chats"
                className="flex items-center gap-2 text-[#3B82F6]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 600 }}
              >
                <ArrowLeft size={18} />
                Chats
              </button>
              <ThemeToggle />
            </div>
            <div className="flex-1 min-h-0">
              <ChatThread sessionId={activeSessionId} />
            </div>
          </div>
        )}
        <AddToHomeScreen />
      </div>

      {/* ── Desktop ── */}
      <div className="hidden md:flex w-full flex-1 min-h-0">
        <SessionList themeToggle={<ThemeToggle />} />
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
