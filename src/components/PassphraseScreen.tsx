import { useState } from "react";
import { Lock } from "lucide-react";
import { avatars } from "../lib/avatars";

interface PassphraseScreenProps {
  /** Verify the passphrase against the launcher. Resolves true on success. */
  onSubmit: (passphrase: string) => Promise<boolean>;
}

// Shown when the launcher's passphrase gate returns 401. Calm, single-field
// unlock — on success the launcher sets the HttpOnly auth cookie and the app
// retries its normal connect flow. The browser remembers the cookie, so this is
// a once-per-device step, not every launch.
export function PassphraseScreen({ onSubmit }: PassphraseScreenProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onSubmit(value);
    if (!ok) {
      setFailed(true);
      setBusy(false);
    }
    // On success we leave it busy — App.tsx swaps this screen out as the connect
    // flow resumes, so there's nothing to reset.
  }

  return (
    <div className="min-h-svh bg-white dark:bg-[#1C1917] flex flex-col items-center justify-center px-6">
      <main className="w-full max-w-sm flex flex-col items-center text-center gap-8">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#F97316]/10 blur-2xl opacity-60 pointer-events-none" />
          <div className="absolute inset-4 rounded-full bg-[#fef3c7] border-4 border-white shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center">
            <img src={avatars.locked} alt="" aria-hidden="true" className="w-22 h-22 object-contain" />
          </div>
        </div>

        <div className="space-y-3">
          <h1
            className="text-[#1e1e2e] dark:text-[#F5F0EB] tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}
          >
            Unlock Pebble
          </h1>
          <p
            className="text-[#757780] dark:text-[#A8A29E] leading-relaxed"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 500 }}
          >
            Enter your passphrase to open your chats. We'll remember it on this
            device.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-4">
          <div className="relative w-full">
            <Lock
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757780] pointer-events-none"
            />
            <input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setFailed(false);
              }}
              placeholder="Passphrase"
              aria-label="Passphrase"
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#e2e8f0] dark:border-[#3a3531] bg-[#f8f9fa] dark:bg-[#262220] py-3 pl-11 pr-4 text-[#1e1e2e] dark:text-[#F5F0EB] outline-none transition-colors focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#1C1917]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 500 }}
            />
          </div>

          {failed && (
            <p
              className="text-[#ef4444]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600 }}
            >
              That passphrase didn't work. Try again.
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#3B82F6] hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold py-3 px-8 rounded-full transition-colors duration-200"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </main>
    </div>
  );
}
