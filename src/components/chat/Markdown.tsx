import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  content: string;
}

/**
 * Renders agent message text as GitHub-flavoured markdown (tables, lists, code,
 * links, etc.). Styling is scoped here rather than via @tailwindcss/typography
 * to keep the bundle lean and to match Pebble's warm palette. Incomplete markdown
 * from streaming chunks degrades gracefully — react-markdown renders the partial
 * source as plain text until the closing token arrives.
 */
export function Markdown({ content }: MarkdownProps) {
  return (
    <div className="pebble-md">
      <style>{`
        .pebble-md > :first-child { margin-top: 0; }
        .pebble-md > :last-child { margin-bottom: 0; }
        .pebble-md p { margin: 0.5em 0; }
        .pebble-md h1, .pebble-md h2, .pebble-md h3,
        .pebble-md h4, .pebble-md h5, .pebble-md h6 {
          font-weight: 700; line-height: 1.3; margin: 0.8em 0 0.4em;
        }
        .pebble-md h1 { font-size: 1.3em; }
        .pebble-md h2 { font-size: 1.2em; }
        .pebble-md h3 { font-size: 1.1em; }
        .pebble-md ul, .pebble-md ol { margin: 0.5em 0; padding-left: 1.4em; }
        .pebble-md ul { list-style: disc; }
        .pebble-md ol { list-style: decimal; }
        .pebble-md li { margin: 0.2em 0; }
        .pebble-md li > ul, .pebble-md li > ol { margin: 0.2em 0; }
        .pebble-md a { color: #3B82F6; text-decoration: underline; }
        .pebble-md strong { font-weight: 700; }
        .pebble-md em { font-style: italic; }
        .pebble-md blockquote {
          border-left: 3px solid #D6CEC4; padding-left: 0.8em;
          margin: 0.5em 0; color: #7A746D;
        }
        .pebble-md code {
          font-family: 'JetBrains Mono', monospace; font-size: 0.88em;
          background: rgba(0,0,0,0.06); padding: 0.1em 0.35em; border-radius: 4px;
        }
        .pebble-md pre {
          background: rgba(0,0,0,0.06); padding: 0.7em 0.9em; border-radius: 8px;
          overflow-x: auto; margin: 0.6em 0;
        }
        .pebble-md pre code { background: none; padding: 0; font-size: 0.85em; }
        .pebble-md table {
          border-collapse: collapse; margin: 0.6em 0; width: 100%; font-size: 0.92em;
        }
        .pebble-md th, .pebble-md td {
          border: 1px solid #D6CEC4; padding: 0.35em 0.6em; text-align: left;
        }
        .pebble-md th { font-weight: 700; background: rgba(0,0,0,0.04); }
        .pebble-md hr { border: none; border-top: 1px solid #D6CEC4; margin: 0.8em 0; }
        .dark .pebble-md code, .dark .pebble-md pre { background: rgba(255,255,255,0.08); }
        .dark .pebble-md blockquote { border-left-color: #44403C; color: #A8A29E; }
        .dark .pebble-md th, .dark .pebble-md td { border-color: #44403C; }
        .dark .pebble-md th { background: rgba(255,255,255,0.05); }
        .dark .pebble-md hr { border-top-color: #44403C; }
      `}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
