import { RotateCcw } from "lucide-react";
import { avatars } from "../lib/avatars";

interface ConnectingScreenProps {
  error?: boolean;
  onRetry?: () => void;
}

export function ConnectingScreen({ error, onRetry }: ConnectingScreenProps) {
  if (error) {
    return (
      <div className="min-h-svh bg-white flex items-center justify-center px-6">
        <main className="w-full max-w-sm flex flex-col items-center text-center gap-8">
          <div className="relative w-44 h-44 flex items-center justify-center mb-0">
            <div className="absolute inset-0 rounded-full bg-red-100/60 blur-2xl opacity-70 pointer-events-none" />
            <div className="absolute inset-4 rounded-full bg-[#fee2e2] border-4 border-white shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center">
              <img src={avatars.error} alt="" aria-hidden="true" className="w-22 h-22 object-contain" />
            </div>
          </div>

          <div className="space-y-3">
            <h1
              className="text-[#1e1e2e] tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}
            >
              Lost the signal.
            </h1>
            <p
              className="text-[#757780] leading-relaxed"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 500 }}
            >
              It looks like the connection dropped. Ask your agent for a fresh
              link, or try reconnecting.
            </p>
          </div>

          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 bg-[#3B82F6] hover:bg-[#2563eb] text-white text-[13px] font-semibold py-3 px-8 rounded-full transition-colors duration-200"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <RotateCcw size={16} />
            Retry connection
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-white flex flex-col items-center justify-center px-6 overflow-hidden relative">
      <div className="fixed top-[-10%] left-[-10%] w-80 h-80 bg-[#3B82F6]/10 rounded-full blur-3xl opacity-60 pointer-events-none animate-pulse" />
      <div
        className="fixed bottom-[-10%] right-[-10%] w-72 h-72 bg-[#F97316]/10 rounded-full blur-3xl opacity-50 pointer-events-none animate-pulse"
        style={{ animationDelay: "1s" }}
      />

      <main className="relative z-10 flex flex-col items-center text-center gap-6 max-w-xs">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#3B82F6]/10 blur-2xl opacity-60 animate-pulse pointer-events-none" />
          <div className="absolute inset-4 rounded-full bg-[#dbeafe] border-4 border-white shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center">
            <img
              src={avatars.connecting}
              alt=""
              aria-hidden="true"
              className="w-22 h-22 object-contain animate-[bounce_3s_ease-in-out_infinite]"
              style={{ animationDirection: "alternate" }}
            />
          </div>
        </div>

        <h1
          className="text-[#1e1e2e] tracking-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}
        >
          Finding your agent...
        </h1>
        <p
          className="text-[#757780] leading-relaxed"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 500 }}
        >
          Just a moment while we set things up.
        </p>

        <div className="flex gap-3 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
