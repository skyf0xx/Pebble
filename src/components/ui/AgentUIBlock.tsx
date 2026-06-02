import { defineRegistry, createRenderer } from "@json-render/react";
import { shadcnComponents, shadcnComponentDefinitions } from "@json-render/shadcn";
import { send } from "../../lib/connection";
import type { AgentUISpec } from "../../types";
import type { Spec } from "@json-render/react";

const variantStyles: Record<string, string> = {
  primary:   "text-blue-500 font-semibold hover:bg-blue-50",
  secondary: "text-slate-400 hover:bg-slate-100",
  danger:    "text-red-500 hover:bg-red-50",
};
const defaultStyle = "text-slate-400 hover:bg-slate-100";

const intentToVariant: Record<string, string> = {
  confirm:     "primary",
  dismiss:     "secondary",
  destructive: "danger",
};

const ghostButton = ({ props, emit }: { props: Record<string, unknown>; emit: (e: string) => void }) => {
  const variant = typeof props.variant === "string" ? props.variant : "secondary";
  const style = variantStyles[variant] ?? defaultStyle;
  // Agents naturally bind their click handler under either `press` or `click`.
  // emit() is a no-op for an unbound event, so firing both covers both spellings
  // without double-dispatching (only the bound one runs).
  const handleClick = () => {
    emit("press");
    emit("click");
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium bg-transparent transition-colors disabled:opacity-50 ${style}`}
      disabled={props.disabled === true}
      onClick={handleClick}
    >
      {props.label as string}
    </button>
  );
};

const { registry } = defineRegistry(shadcnComponentDefinitions as never, {
  components: { ...(shadcnComponents as Record<string, unknown>), Button: ghostButton } as never,
});
const ShadcnRenderer = createRenderer(shadcnComponentDefinitions as never, registry);

interface AgentUIBlockProps {
  spec: AgentUISpec;
  sessionId: string;
  messageId: string;
}

// The shadcn Table component expects `columns: string[]` and `rows: string[][]`.
// Agents commonly emit the richer `{key,label}` column / row-object shape instead,
// which fails the schema and renders an empty body (header only). Coerce it here.
function normalizeTableProps(props: Record<string, unknown>): Record<string, unknown> {
  const rawColumns = props.columns;
  if (!Array.isArray(rawColumns)) return props;

  const objectColumns = rawColumns.every(
    (c) => c !== null && typeof c === "object",
  );
  if (!objectColumns) return props; // already string[] — leave as-is

  const cols = rawColumns as Array<Record<string, unknown>>;
  const keys = cols.map((c) => String(c.key ?? c.label ?? ""));
  const columns = cols.map((c) => String(c.label ?? c.key ?? ""));

  const rawRows = Array.isArray(props.rows) ? props.rows : [];
  const rows = rawRows.map((row) => {
    if (Array.isArray(row)) return row.map((cell) => String(cell ?? ""));
    if (row !== null && typeof row === "object") {
      const r = row as Record<string, unknown>;
      return keys.map((k) => String(r[k] ?? ""));
    }
    return [String(row ?? "")];
  });

  return { ...props, columns, rows };
}

// shadcn's Stack/Grid `gap` is a named scale, not pixels. Agents often emit a
// numeric `spacing`/`padding` instead — bucket it to the nearest token.
function pxToGap(px: number): string {
  if (px <= 0) return "none";
  if (px <= 6) return "sm";
  if (px <= 14) return "md";
  if (px <= 24) return "lg";
  return "xl";
}

// Components that carry their content in a `text` prop. When an agent instead
// nests the content in a child element (a child `Text`/`text` node with
// `content`/`text`/`children`), we lift it up into this prop and drop the child.
const TEXT_PROP_TYPES = new Set(["Heading", "Text", "Badge", "Link"]);

type El = Record<string, unknown>;

// Pull a plain-text string out of an element, however the agent spelled it:
// props.text, props.content, props.label, or a lone string child.
function extractText(el: El, all: Record<string, El>): string | undefined {
  const props = (el.props ?? {}) as Record<string, unknown>;
  for (const k of ["text", "content", "label", "value"]) {
    if (typeof props[k] === "string") return props[k] as string;
  }
  const children = Array.isArray(el.children) ? el.children : [];
  for (const c of children) {
    if (typeof c === "string" && !all[c]) return c; // inline string child
    const child = typeof c === "string" ? all[c] : (c as El);
    if (child) {
      const t = extractText(child, all);
      if (t !== undefined) return t;
    }
  }
  return undefined;
}

// True when an element exists only to hold text for a parent (a `text`/`Text`
// node, or any node whose sole job is a content string). Such nodes are folded
// into the parent's prop and removed from the spec.
function isTextCarrier(el: El): boolean {
  const type = String(el.type ?? "");
  return type.toLowerCase() === "text";
}

function normalizeSpec(spec: AgentUISpec): Spec {
  const rawElements = (spec.elements ?? {}) as Record<string, El>;

  // Pass 1 — lift child-borne text into the parent's content prop, and record
  // which child ids were consumed so we can prune them and their references.
  const consumed = new Set<string>();
  const lifted: Record<string, El> = {};

  for (const [key, el] of Object.entries(rawElements)) {
    const element = { ...el };
    const type = String(element.type ?? "");
    const props = { ...((element.props ?? {}) as Record<string, unknown>) };

    // content -> text alias (shadcn never uses `content` on these)
    if (typeof props.content === "string" && props.text === undefined) {
      props.text = props.content;
    }

    if (TEXT_PROP_TYPES.has(type) && typeof props.text !== "string") {
      const t = extractText(element, rawElements);
      if (t !== undefined) props.text = t;
    }

    if (type === "Button" && typeof props.label !== "string") {
      const t = extractText(element, rawElements);
      if (t !== undefined) props.label = t;
    }

    // After lifting, drop any child ids that were pure text carriers.
    if (Array.isArray(element.children)) {
      const kept: unknown[] = [];
      for (const c of element.children) {
        const childEl = typeof c === "string" ? rawElements[c] : undefined;
        if (typeof c === "string" && childEl && isTextCarrier(childEl)) {
          consumed.add(c);
          continue;
        }
        if (typeof c === "string" && childEl === undefined) continue; // inline string, now in prop
        kept.push(c);
      }
      element.children = kept;
    }

    element.props = props;
    lifted[key] = element;
  }

  // Pass 2 — per-type prop normalization, skipping consumed text carriers.
  const elements: Record<string, unknown> = {};
  for (const [key, el] of Object.entries(lifted)) {
    if (consumed.has(key)) continue;
    const element = el;
    const props = (element.props ?? {}) as Record<string, unknown>;
    let normalizedProps = props;

    if (element.type === "Button" && typeof props.intent === "string") {
      normalizedProps = { ...props, variant: intentToVariant[props.intent] ?? "secondary" };
    } else if (element.type === "Table") {
      normalizedProps = normalizeTableProps(props);
    } else if (element.type === "Stack" || element.type === "Grid") {
      // Map numeric spacing/padding to the named `gap` scale.
      if (props.gap === undefined) {
        const n = props.spacing ?? props.padding;
        if (typeof n === "number") normalizedProps = { ...props, gap: pxToGap(n) };
      }
    }

    elements[key] = { children: [], ...element, props: normalizedProps };
  }

  return { ...spec, elements } as unknown as Spec;
}

export function AgentUIBlock({ spec, sessionId }: AgentUIBlockProps) {
  const castedSpec = normalizeSpec(spec);

  function handleAction(action: string, payload?: Record<string, unknown>) {
    send({
      type: "ui_action",
      session_id: sessionId,
      action,
      payload: payload ?? {},
      timestamp: new Date().toISOString(),
    });
  }

  return (
    <div className="px-3 py-3">
      <ShadcnRenderer
        spec={castedSpec}
        onAction={handleAction}
      />
    </div>
  );
}
