import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Message } from "../../types";

interface ThoughtBlockProps {
  thoughts: Message[];
  isStreaming: boolean;
}

export function ThoughtBlock({ thoughts, isStreaming }: ThoughtBlockProps) {
  const [expanded, setExpanded] = useState(false);

  if (isStreaming) {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5">
        <span className="flex gap-[3px] items-center">
          <Dot delay="0ms" />
          <Dot delay="160ms" />
          <Dot delay="320ms" />
        </span>
        <span
          className="text-[#7A746D] dark:text-[#A8A29E]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 500 }}
        >
          Thinking…
        </span>
      </div>
    );
  }

  // Collapse runs of identical-label thoughts into a single row with a ×N count
  // (e.g. three back-to-back "Ran terminal" calls → "Ran terminal ×3"). The step
  // count still reflects the real number of tool runs.
  const collapsed: Array<{ id: string; content: string; count: number }> = [];
  for (const t of thoughts) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.content === t.content) {
      last.count += 1;
    } else {
      collapsed.push({ id: t.id, content: t.content, count: 1 });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[#7A746D] dark:text-[#A8A29E] hover:text-[#2C2925] dark:hover:text-[#F5F0EB] transition-colors duration-150 px-1 py-1 w-fit"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 500 }}
      >
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
        <span>
          Show thinking · {thoughts.length} {thoughts.length === 1 ? "step" : "steps"}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 pl-5 border-l-2 border-[#e2e8f0] dark:border-[#3C3836] ml-1">
          {collapsed.map((t) => (
            <p
              key={t.id}
              className="text-[#7A746D] dark:text-[#A8A29E] leading-relaxed"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 500 }}
            >
              {t.content}
              {t.count > 1 && (
                <span className="text-[#a0a3ad] dark:text-[#78716c]"> ×{t.count}</span>
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-[#7A746D] dark:bg-[#A8A29E] animate-[bounce_1s_ease-in-out_infinite]"
      style={{ animationDelay: delay, animationDirection: "alternate" }}
    />
  );
}
