import { formatDistanceToNowStrict } from "date-fns";
import { makeAvatar } from "../../lib/avatars";
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

  const relativeTime = (() => {
    try {
      return formatDistanceToNowStrict(new Date(session.last_updated), {
        addSuffix: false,
      });
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
        isActive ? "bg-[#EDE8E2]" : "hover:bg-[#f8f9fa]",
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
            "text-[15px] leading-snug truncate text-[#1e1e2e]",
            isUnread ? "font-bold" : "font-medium",
          ].join(" ")}
        >
          {session.label}
        </p>
        <p
          className={[
            "text-[13px] leading-snug truncate mt-0.5",
            isUnread ? "text-[#1e1e2e]" : "text-[#757780]",
          ].join(" ")}
        >
          {session.last_message}
        </p>
      </div>

      {/* Right: timestamp + status */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[11px] text-[#757780] leading-none">
          {relativeTime}
        </span>
        <StatusIcon status={session.status} />
      </div>
    </button>
  );
}
