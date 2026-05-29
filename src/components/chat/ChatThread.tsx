import { useEffect, useRef } from "react";
import { useAppStore } from "../../store";
import { send } from "../../lib/ws";
import { MessageBubble } from "./MessageBubble";
import { ThoughtBlock } from "./ThoughtBlock";
import { InputBar } from "./InputBar";
import { AgentUIBlock } from "../ui/AgentUIBlock";
import type { Message } from "../../types";

interface ChatThreadProps {
  sessionId: string;
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

  return result;
}

export function ChatThread({ sessionId }: ChatThreadProps) {
  const rawMessages = useAppStore((s) => s.messages[sessionId]);
  const messages = rawMessages ?? [];
  const session = useAppStore((s) => s.sessions.find((s) => s.session_id === sessionId));
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      <header className="shrink-0 px-6 py-4 border-b border-[#e2e8f0] dark:border-[#3C3836] bg-white dark:bg-[#1C1917] flex items-center gap-3">
        {session && (
          <span
            className="text-[#1e1e2e] dark:text-[#F5F0EB] truncate"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700 }}
          >
            {session.label}
          </span>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 bg-white dark:bg-[#1C1917]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <span
              className="text-[#a0a3ad] dark:text-[#78716c] tracking-widest animate-pulse"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20 }}
            >
              ...
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

      <InputBar sessionId={sessionId} />
    </div>
  );
}
