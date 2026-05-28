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

  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
        isActive ? "bg-[#EDE8E2]" : "hover:bg-[#f8f9fa]",
      ].join(" ")}
    >
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
