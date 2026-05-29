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
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium bg-transparent transition-colors disabled:opacity-50 ${style}`}
      disabled={props.disabled === true}
      onClick={() => emit("press")}
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

function normalizeSpec(spec: AgentUISpec): Spec {
  const elements: Record<string, unknown> = {};
  for (const [key, el] of Object.entries(spec.elements ?? {})) {
    const element = el as Record<string, unknown>;
    const props = (element.props ?? {}) as Record<string, unknown>;
    const normalizedProps =
      element.type === "Button" && typeof props.intent === "string"
        ? { ...props, variant: intentToVariant[props.intent] ?? "secondary" }
        : props;
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
    <div className="rounded bg-[#fdfcfb] px-3 py-3">
      <ShadcnRenderer
        spec={castedSpec}
        onAction={handleAction}
      />
    </div>
  );
}
