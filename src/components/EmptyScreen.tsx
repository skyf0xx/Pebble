import { CheckCircle, Plus } from "lucide-react";
import { avatars } from "../lib/avatars";

export function EmptyScreen() {
  return (
    <div className="min-h-svh bg-white dark:bg-[#1C1917] flex flex-col overflow-hidden">
      {/* ── Mobile ── */}
      <div className="flex flex-col flex-1 md:hidden overflow-hidden">
        <header className="flex items-center px-8 py-4 bg-[#f2f3fd] dark:bg-[#292524] rounded-b-2xl shadow-[0_8px_30px_rgba(59,130,246,0.10)] z-10 shrink-0">
          <span
            className="text-[#3B82F6] tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}
          >
            Pebble
          </span>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-8 relative overflow-hidden">
          <Background />
          <IconHalo />
          <div className="text-center max-w-xs space-y-3 z-10">
            <h1
              className="text-[#1e1e2e] dark:text-[#F5F0EB] tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 40, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" }}
            >
              Hello
            </h1>
            <p
              className="text-[#757780] dark:text-[#A8A29E] leading-relaxed"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 500 }}
            >
              Ask your agent for your Pebble link to start chatting.
            </p>
          </div>
        </main>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden md:flex min-h-svh">
        {/* Sidebar */}
        <aside className="w-70 shrink-0 h-screen bg-[#f8f9fa] dark:bg-[#292524] border-r border-[#e2e8f0] dark:border-[#3C3836] flex flex-col">
          <div className="px-6 pt-8 pb-4 flex items-center gap-3">
            <span
              className="text-[#3B82F6] tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700 }}
            >
              Pebble
            </span>
          </div>

          <div className="px-6 pb-6">
            <button
              className="w-full flex items-center justify-center gap-2 bg-[#3B82F6] text-white rounded-full py-3 px-5 shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all duration-200"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600 }}
            >
              <Plus size={16} />
              New Chat
            </button>
          </div>

          <div className="px-6 pb-3">
            <span
              className="text-[#757780] dark:text-[#78716c] uppercase tracking-widest"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600 }}
            >
              Active Chats
            </span>
          </div>

          <div className="mx-4 px-4 py-6 rounded-2xl bg-[#ecedf7]/50 dark:bg-[#2A2520] flex flex-col items-center justify-center text-center gap-2">
            <CheckCircle size={28} stroke="#c2c6d6" strokeWidth={1.5} />
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 500 }} className="text-[#757780] dark:text-[#A8A29E]">
              No active chats
            </p>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12 }} className="text-[#a0a3ad] dark:text-[#78716c]">
              Start a chat to create one.
            </p>
          </div>
        </aside>

        {/* Main canvas */}
        <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-white dark:bg-[#1C1917]">
          <Background />
          <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
            <IconHalo large />
            <div className="space-y-4 mt-2">
              <h1
                className="text-[#1e1e2e] dark:text-[#F5F0EB] tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 40, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" }}
              >
                Hello
              </h1>
              <p
                className="text-[#757780] dark:text-[#A8A29E] leading-relaxed"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 500 }}
              >
                Ask your agent for your Pebble link to start chatting.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function IconHalo({ large = false }: { large?: boolean }) {
  const outer = large ? "w-52 h-52" : "w-44 h-44";
  const img   = large ? "w-28 h-28" : "w-22 h-22";

  return (
    <div className={`relative ${outer} flex items-center justify-center mb-8 z-10`}>
      <div className="absolute inset-0 rounded-full bg-[#3B82F6]/10 blur-2xl opacity-60 animate-pulse pointer-events-none" />
      <div className="absolute inset-4 rounded-full bg-[#f2f3fd] dark:bg-[#3C3836] border-4 border-white dark:border-[#292524] shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center">
        <img
          src={avatars.pebble}
          alt=""
          aria-hidden="true"
          className={`${img} object-contain rounded-xl animate-[bounce_4s_ease-in-out_infinite]`}
          style={{ animationDirection: "alternate" }}
        />
      </div>
    </div>
  );
}

function Background() {
  return (
    <>
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#adc6ff]/20 rounded-full mix-blend-multiply blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#F97316]/10 rounded-full mix-blend-multiply blur-3xl opacity-50 pointer-events-none" />
    </>
  );
}
