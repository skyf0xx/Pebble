import { Plus } from "lucide-react";
import { useAppStore } from "../../store";
import { send } from "../../lib/ws";
import { SessionRow } from "./SessionRow";
import type { SessionMeta } from "../../types";

interface SessionListProps {
  onSelectSession?: (sessionId: string) => void;
}

export function SessionList({ onSelectSession }: SessionListProps) {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  const active = sessions.filter((s) => s.status === "active" || s.status === "waiting");
  const completed = sessions.filter((s) => s.status === "done" || s.status === "error");

  function handleSelect(session: SessionMeta) {
    setActiveSession(session.session_id);
    send({ type: "session_resume", session_id: session.session_id });
    onSelectSession?.(session.session_id);
  }

  function handleNewChat() {
    send({ type: "session_create" });
  }

  return (
    <>
      {/* ── Mobile ── */}
      <div className="flex flex-col h-full md:hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-[#f2f3fd] rounded-b-2xl shadow-[0_8px_30px_rgba(59,130,246,0.10)] z-10 shrink-0">
          <span
            className="text-[#3B82F6] tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}
          >
            Pebble
          </span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <SectionedList
            active={active}
            completed={completed}
            activeSessionId={activeSessionId}
            onSelect={handleSelect}
          />
        </div>

        {/* Floating + button */}
        <button
          onClick={handleNewChat}
          aria-label="New chat"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#3B82F6] text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-600 active:scale-95 transition-all duration-200 z-20"
        >
          <Plus size={22} />
        </button>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-[280px] shrink-0 h-screen bg-[#f8f9fa] border-r border-[#e2e8f0] flex-col">
        <div className="px-6 pt-8 pb-4">
          <span
            className="text-[#3B82F6] tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700 }}
          >
            Pebble
          </span>
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-[#3B82F6] text-white rounded-full py-3 px-5 shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all duration-200"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600 }}
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SectionedList
            active={active}
            completed={completed}
            activeSessionId={activeSessionId}
            onSelect={handleSelect}
          />
        </div>
      </aside>
    </>
  );
}

interface SectionedListProps {
  active: SessionMeta[];
  completed: SessionMeta[];
  activeSessionId: string | null;
  onSelect: (s: SessionMeta) => void;
}

function SectionedList({ active, completed, activeSessionId, onSelect }: SectionedListProps) {
  const isEmpty = active.length === 0 && completed.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-2 py-16">
        <p
          className="text-[#757780]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 500 }}
        >
          No chats yet.
        </p>
        <p
          className="text-[#a0a3ad]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13 }}
        >
          Start one with your agent.
        </p>
      </div>
    );
  }

  return (
    <div>
      {active.length > 0 && (
        <section>
          <SectionHeader label="Active" />
          {active.map((s) => (
            <SessionRow
              key={s.session_id}
              session={s}
              isActive={s.session_id === activeSessionId}
              onClick={() => onSelect(s)}
            />
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <SectionHeader label="Completed" />
          {completed.map((s) => (
            <SessionRow
              key={s.session_id}
              session={s}
              isActive={s.session_id === activeSessionId}
              onClick={() => onSelect(s)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-5 pb-2">
      <span
        className="text-[#757780] uppercase tracking-widest"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600 }}
      >
        {label}
      </span>
    </div>
  );
}
