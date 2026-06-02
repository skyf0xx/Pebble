import React from "react";
import { Plus, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAppStore } from "../../store";
import { send, buildConnectLink, fetchConnectInfo } from "../../lib/connection";
import { SetupScreen } from "../SetupScreen";
import { SessionRow } from "./SessionRow";
import type { SessionMeta } from "../../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionListProps {
  onSelectSession?: (sessionId: string) => void;
  themeToggle?: React.ReactNode;
}

// A recently-finished session stays in the "Active" section for this long
// before settling into "Completed", so a chat you were just in doesn't drop
// away the instant the agent stops.
const FRESH_WINDOW_MS = 5 * 60 * 1000;

export function SessionList({ onSelectSession, themeToggle }: SessionListProps) {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const loadMessagesForSession = useAppStore((s) => s.loadMessagesForSession);
  const setPendingSession = useAppStore((s) => s.setPendingSession);
  const wsUrl = useAppStore((s) => s.wsUrl);
  const connectionConfig = useAppStore((s) => s.connectionConfig);

  // "Open on phone" branches on whether a Tailscale tunnel is exposing this
  // launcher (asked of the launcher via /api/connect-info):
  //   checking → querying the launcher
  //   qr       → tunnel is up; show the QR encoding the tunnel URL
  //   wizard   → no tunnel yet; walk the user through `tailscale serve`
  // `idle` is closed. `tunnelUrl` holds the discovered address for the QR.
  type PhoneFlow = "idle" | "checking" | "qr" | "wizard";
  const [phoneFlow, setPhoneFlow] = useState<PhoneFlow>("idle");
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);

  // The sidebar "Open on phone" click: show a brief "Checking…" then route to
  // the QR (tunnel up) or the wizard (no tunnel yet).
  async function handleOpenOnPhone() {
    setPhoneFlow("checking");
    const { tunnelUrl } = await fetchConnectInfo();
    setTunnelUrl(tunnelUrl);
    setPhoneFlow(tunnelUrl ? "qr" : "wizard");
  }

  // The wizard's "I've run it — show QR" retry. Re-queries without tearing the
  // wizard down (no "checking" flash); on success swaps straight to the QR, on
  // failure stays put and returns false so the wizard shows "not found yet".
  async function recheckTunnel(): Promise<boolean> {
    const { tunnelUrl } = await fetchConnectInfo();
    if (tunnelUrl) {
      setTunnelUrl(tunnelUrl);
      setPhoneFlow("qr");
      return true;
    }
    return false;
  }

  // A session counts as "active" if it's genuinely running/waiting, OR if it
  // finished within the freshness window — a chat you were just in shouldn't
  // drop into "Completed" the instant the agent stops. Older done/error
  // sessions settle into the completed section. `now` ticks every 30s so a
  // fresh session re-buckets itself once the window elapses, rather than
  // waiting on an unrelated re-render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const isFresh = (s: SessionMeta) =>
    now - new Date(s.last_updated).getTime() <= FRESH_WINDOW_MS;
  const active = sessions.filter(
    (s) => s.status === "active" || s.status === "waiting" || isFresh(s),
  );
  const completed = sessions.filter(
    (s) => (s.status === "done" || s.status === "error") && !isFresh(s),
  );

  function handleSelect(session: SessionMeta) {
    setActiveSession(session.session_id);
    loadMessagesForSession(session.session_id);
    send({ type: "session_resume", session_id: session.session_id });
    onSelectSession?.(session.session_id);
  }

  function handleNewChat() {
    setPendingSession(true);
    setActiveSession("__pending__");
    onSelectSession?.("__pending__");
    send({ type: "session_create" });
  }

  return (
    <>
      {/* ── Mobile ── */}
      <div className="flex flex-col h-full md:hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-[#f2f3fd] dark:bg-[#292524] rounded-b-2xl shadow-[0_8px_30px_rgba(59,130,246,0.10)] z-10 shrink-0">
          <span
            className="text-[#3B82F6] tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}
          >
            Pebble
          </span>
          <div className="flex items-center gap-1">
            {themeToggle}
          </div>
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
      <aside className="hidden md:flex w-[280px] shrink-0 h-screen bg-[#f8f9fa] dark:bg-[#292524] border-r border-[#e2e8f0] dark:border-[#3C3836] flex-col">
        <div className="px-6 pt-8 pb-4 flex items-center justify-between">
          <span
            className="text-[#3B82F6] tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700 }}
          >
            Pebble
          </span>
          <div className="flex items-center gap-1">
            {themeToggle}
          </div>
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

        {wsUrl && (
          <div className="px-4 py-4 border-t border-[#e2e8f0] dark:border-[#3C3836] shrink-0">
            <button
              onClick={handleOpenOnPhone}
              disabled={phoneFlow === "checking"}
              className="w-full flex items-center justify-center gap-2 text-[#757780] dark:text-[#A8A29E] hover:text-[#3B82F6] dark:hover:text-[#F5F0EB] rounded-lg py-2 px-3 hover:bg-[#eff6ff] dark:hover:bg-[#2A2520] transition-colors duration-200 disabled:opacity-60"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600 }}
            >
              <Smartphone size={15} />
              {phoneFlow === "checking" ? "Checking…" : "Open on phone"}
            </button>
          </div>
        )}
      </aside>

      {/* Open-on-phone: QR when a tunnel is up, the Tailscale wizard when not. */}
      <Dialog
        open={phoneFlow === "qr"}
        onOpenChange={(o) => !o && setPhoneFlow("idle")}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}
            >
              Open on your phone
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-xl p-3 bg-white dark:bg-[#1C1917] border border-[#e2e8f0] dark:border-[#3C3836] shadow-sm">
              <QRCodeSVG
                value={
                  connectionConfig
                    ? buildConnectLink(connectionConfig, tunnelUrl ?? undefined)
                    : window.location.href
                }
                size={200}
                fgColor="#1e1e2e"
                bgColor="#ffffff"
                level="M"
              />
            </div>
            <p
              className="text-center text-[#757780]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 500 }}
            >
              Scan to open Pebble on your phone — it'll connect to your agent
              automatically. Make sure Tailscale is running on the phone first.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* No tunnel detected → full-screen Tailscale setup wizard as a dismissable
          destination. Its final step re-checks for the tunnel (recheckTunnel)
          and, when found, swaps straight to the QR — so the user never has to
          re-find "Open on phone". The X just closes back here. */}
      {phoneFlow === "wizard" && (
        <div className="fixed inset-0 z-50">
          <SetupScreen
            onClose={() => setPhoneFlow("idle")}
            onRecheck={recheckTunnel}
          />
        </div>
      )}
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
          className="text-[#757780] dark:text-[#A8A29E]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 500 }}
        >
          No chats yet.
        </p>
        <p
          className="text-[#a0a3ad] dark:text-[#78716c]"
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
        className="text-[#757780] dark:text-[#78716c] uppercase tracking-widest"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600 }}
      >
        {label}
      </span>
    </div>
  );
}
