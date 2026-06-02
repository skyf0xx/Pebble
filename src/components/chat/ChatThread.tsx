import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../../store";
import { send } from "../../lib/connection";
import { makeAvatar } from "../../lib/avatars";
import { displayLabel } from "../../lib/adapters/hermes";
import { MessageBubble } from "./MessageBubble";
import { ThoughtBlock } from "./ThoughtBlock";
import { InputBar } from "./InputBar";
import { AgentUIBlock } from "../ui/AgentUIBlock";
import type { Message } from "../../types";

interface ChatThreadProps {
  sessionId: string;
  onBack?: () => void;
  themeToggle?: ReactNode;
}

interface AgentTurn {
  messageId: string;
  thoughts: Message[];
  messages: Message[];
  isStreamingThought: boolean;
}

function groupMessages(messages: Message[]) {
  const result: Array<{ type: "user"; message: Message } | { type: "agent-turn"; turn: AgentTurn }> = [];
  const agentTurns = new Map<string, AgentTurn>();

  for (const msg of messages) {
    if (msg.role === "user") {
      result.push({ type: "user", message: msg });
      continue;
    }

    // Agent messages are grouped by message_id (id field)
    const turnId = msg.id;
    if (!agentTurns.has(turnId)) {
      const turn: AgentTurn = { messageId: turnId, thoughts: [], messages: [], isStreamingThought: false };
      agentTurns.set(turnId, turn);
      result.push({ type: "agent-turn", turn });
    }

    const turn = agentTurns.get(turnId)!;
    if (msg.kind === "thought") {
      turn.thoughts.push(msg);
      if (msg.streaming) turn.isStreamingThought = true;
      else turn.isStreamingThought = false;
    } else {
      turn.messages.push(msg);
    }
  }

  // Merge runs of consecutive thought-only turns (each non-pebble_send tool
  // call arrives as its own message_id, so N tool runs become N turns). A turn
  // is "thought-only" when it carries no message content. Collapsing them keeps
  // a sequence of tool runs under a single "Show thinking" disclosure.
  const merged: typeof result = [];
  for (const item of result) {
    const prev = merged[merged.length - 1];
    const isThoughtOnly = item.type === "agent-turn" && item.turn.messages.length === 0;
    const prevThoughtOnly =
      prev && prev.type === "agent-turn" && prev.turn.messages.length === 0;

    if (item.type === "agent-turn" && isThoughtOnly && prevThoughtOnly) {
      prev.turn.thoughts.push(...item.turn.thoughts);
      // Streaming state follows the most recent thought in the run.
      prev.turn.isStreamingThought = item.turn.isStreamingThought;
    } else {
      merged.push(item);
    }
  }

  return merged;
}

export function ChatThread({ sessionId, onBack, themeToggle }: ChatThreadProps) {
  const isPending = sessionId === "__pending__";
  const rawMessages = useAppStore((s) => s.messages[sessionId]);
  const messages = rawMessages ?? [];
  const session = useAppStore((s) => s.sessions.find((s) => s.session_id === sessionId));
  const bottomRef = useRef<HTMLDivElement>(null);
  const avatarUrl = session ? makeAvatar(session.session_id) : null;

  useEffect(() => {
    if (isPending) return;
    if (messages.length === 0) {
      send({ type: "session_resume", session_id: sessionId });
    }
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const grouped = groupMessages(messages);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <header className="shrink-0 px-2 py-2 border-b border-[#e2e8f0] dark:border-[#3C3836] bg-white dark:bg-[#1C1917] flex items-center gap-1">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="p-2 text-[#3B82F6] shrink-0"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt=""
            className="w-8 h-8 rounded-full shrink-0"
          />
        )}
        <span
          className="text-[#1e1e2e] dark:text-[#F5F0EB] truncate flex-1 min-w-0 ml-1"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 700 }}
        >
          {isPending ? (
            <span className="text-[#a0a3ad] dark:text-[#78716c]">New chat</span>
          ) : (
            session && displayLabel(session.label)
          )}
        </span>
        {themeToggle && <div className="shrink-0">{themeToggle}</div>}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 bg-white dark:bg-[#1C1917]">
        {isPending || messages.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <span
              className="text-[#a0a3ad] dark:text-[#78716c] tracking-widest animate-pulse"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20 }}
            >
              {isPending ? "Starting chat..." : "..."}
            </span>
          </div>
        ) : (
          grouped.map((item, i) => {
            if (item.type === "user") {
              return <MessageBubble key={item.message.id} message={item.message} />;
            }

            const { turn } = item;
            return (
              <div key={turn.messageId + "-" + i} className="flex flex-col gap-3">
                {turn.thoughts.length > 0 && (
                  <ThoughtBlock
                    thoughts={turn.thoughts}
                    isStreaming={turn.isStreamingThought}
                  />
                )}
                {turn.messages.map((m) => (
                  <div key={m.id + "-msg"} className="flex flex-col gap-2">
                    {m.content && <MessageBubble message={m} />}
                    {m.uiSpec && (
                      <div className="ml-10 max-w-[75%]">
                        <AgentUIBlock
                          spec={m.uiSpec}
                          sessionId={sessionId}
                          messageId={m.id}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <InputBar sessionId={sessionId} disabled={isPending} />
    </div>
  );
}
