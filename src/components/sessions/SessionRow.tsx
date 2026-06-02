import { formatDistanceToNowStrict } from "date-fns";
import { makeAvatar } from "../../lib/avatars";
import { displayLabel } from "../../lib/adapters/hermes";
import { StatusIcon } from "./StatusIcon";
import type { SessionMeta } from "../../types";

interface SessionRowProps {
  session: SessionMeta;
  isActive: boolean;
  onClick: () => void;
}

export function SessionRow({ session, isActive, onClick }: SessionRowProps) {
  const avatar = makeAvatar(session.session_id);
  const isUnread = session.unread > 0;
  const label = displayLabel(session.label);

  const relativeTime = (() => {
    try {
      const formatted =  formatDistanceToNowStrict(new Date(session.last_updated), {
        addSuffix: false,
      });
      return formatted
    } catch {
      return "";
    }
  })();

  const isDone = session.status === "done";
  const isWaiting = session.status === "waiting";

  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-300",
        isActive ? "bg-[#EDE8E2] dark:bg-[#3C3836]" : "hover:bg-[#f8f9fa] dark:hover:bg-[#2A2520]",
        isDone ? "opacity-75" : "opacity-100",
        isWaiting ? "border-l-2 border-l-amber-400 animate-[waitingPulse_2s_ease-in-out_infinite]" : "border-l-2 border-l-transparent",
      ].join(" ")}
    >
      <style>{`
        @keyframes waitingPulse {
          0%, 100% { border-left-color: transparent; }
          50% { border-left-color: #FBBF24; }
        }
      `}</style>
      {/* Avatar */}
      <img
        src={avatar}
        alt=""
        width={40}
        height={40}
        className="rounded-full shrink-0"
      />

      {/* Centre */}
      <div className="flex-1 min-w-0">
        <p
          className={[
            "text-[15px] leading-snug truncate text-[#1e1e2e] dark:text-[#F5F0EB]",
            isUnread ? "font-bold" : "font-medium",
          ].join(" ")}
        >
          {label}
        </p>
        <div className="flex items-center gap-1 mt-0.5 min-w-0">
          <StatusIcon status={session.status} />
          <p
            className={[
              "text-[13px] leading-snug truncate",
              isUnread ? "text-[#1e1e2e] dark:text-[#F5F0EB]" : "text-[#757780] dark:text-[#A8A29E]",
            ].join(" ")}
          >
            {session.last_message}
          </p>
        </div>
      </div>

      {/* Right: timestamp + unread */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={["text-[11px] leading-none", isUnread ? "text-[#3B82F6] font-semibold" : "text-[#757780] dark:text-[#78716c]"].join(" ")}>
          {relativeTime}
        </span>
        {isUnread && (
          <span className="min-w-4.5 h-4.5 rounded-full bg-[#3B82F6] text-white text-[11px] font-semibold flex items-center justify-center px-1 leading-none">
            {session.unread > 99 ? "99+" : session.unread}
          </span>
        )}
      </div>
    </button>
  );
}
