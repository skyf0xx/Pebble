import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useAppStore } from "../../store";
import { send } from "../../lib/ws";

interface InputBarProps {
  sessionId: string;
  disabled?: boolean;
}

export function InputBar({ sessionId, disabled = false }: InputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsStatus = useAppStore((s) => s.wsStatus);
  const appendMessage = useAppStore((s) => s.appendMessage);

  const isDisabled = disabled || wsStatus !== "connected";
  const canSend = value.trim().length > 0 && !isDisabled;

  function resetHeight() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    resetHeight();
  }

  function handleSubmit() {
    const content = value.trim();
    if (!content || isDisabled) return;

    const timestamp = new Date().toISOString();

    // Optimistic local append
    appendMessage(sessionId, {
      id: `user-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      kind: "message",
      content,
      timestamp,
    });

    send({ type: "user_message", session_id: sessionId, content, timestamp });

    setValue("");
    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="shrink-0 border-t border-[#e2e8f0] bg-white px-4 py-3">
      <div className="flex items-end gap-2 bg-[#f8f9fa] rounded-2xl px-4 py-2 border border-[#e2e8f0] focus-within:border-[#3B82F6] transition-colors duration-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          placeholder={isDisabled ? "Reconnecting…" : "Tell Pebble what you need…"}
          rows={1}
          className="flex-1 resize-none bg-transparent outline-none text-[#1e1e2e] placeholder-[#a0a3ad] leading-relaxed disabled:opacity-50 min-h-[48px] max-h-[140px] py-2"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 15,
            fontWeight: 500,
            overflowY: "auto",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 mb-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-[#3B82F6] text-white shadow-md shadow-blue-500/25 hover:bg-blue-600 disabled:bg-[#e2e8f0] disabled:shadow-none disabled:text-[#a0a3ad]"
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
