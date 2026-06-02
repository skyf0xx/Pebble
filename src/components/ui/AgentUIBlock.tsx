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

function normalizeSpec(spec: AgentUISpec): Spec {
  const elements: Record<string, unknown> = {};
  for (const [key, el] of Object.entries(spec.elements ?? {})) {
    const element = el as Record<string, unknown>;
    const props = (element.props ?? {}) as Record<string, unknown>;
    let normalizedProps = props;
    if (element.type === "Button" && typeof props.intent === "string") {
      normalizedProps = { ...props, variant: intentToVariant[props.intent] ?? "secondary" };
    } else if (element.type === "Table") {
      normalizedProps = normalizeTableProps(props);
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
