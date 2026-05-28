import type { Message } from "../../types";
import { makeAvatar } from "../../lib/avatars";

interface MessageBubbleProps {
  message: Message;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <img
          src={makeAvatar(message.session_id)}
          alt=""
          aria-hidden="true"
          className="w-8 h-8 rounded-full shrink-0 mb-5"
        />
      )}

      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1`}>
        <div
          className={`
            max-w-[75%] px-4 py-3 leading-relaxed
            ${isUser
              ? "bg-[#F97316] text-white rounded-[16px] rounded-br-[4px]"
              : "bg-[#EDE8E2] text-[#2C2925] rounded-[16px] rounded-bl-[4px]"
            }
          `}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 500 }}
        >
          {message.content}
          {message.streaming && (
            <span className="inline-block w-[2px] h-[1em] bg-[#7A746D] ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
          )}
        </div>
        <span
          className="text-[#a0a3ad] px-1"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 500 }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
