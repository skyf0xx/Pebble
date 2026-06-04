import { Component, type ReactNode } from "react";
import { Renderer } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import type { ActionEvent } from "@openuidev/react-lang";
import { send } from "../../lib/connection";
import type { AgentUISpec } from "../../types";

interface AgentUIBlockProps {
  spec: AgentUISpec; // OpenUI Lang source text
  sessionId: string;
  messageId: string;
}

// A render failure inside <Renderer> (malformed Lang, an unexpected spec shape)
// must not blank the whole chat thread — isolate it behind a boundary so only
// this block degrades to a notice.
class RenderBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[AgentUIBlock] OpenUI render failed", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// OpenUI Lang renderer. The agent emits openui-lang source (see the Hermes
// plugin's pebble-protocol-ui SKILL) and we render it with @openuidev's built-in
// component library. No spec normalization is needed — Lang is parsed and
// validated by the renderer itself, which replaces the json-render coercion
// machinery this component used to carry.
export function AgentUIBlock({ spec, sessionId }: AgentUIBlockProps) {
  // Interactive steps surface here. Only two of OpenUI Lang's action steps reach
  // this handler: `@ToAssistant` (→ "continue_conversation") and `@OpenUrl`
  // (→ "open_url"). The reactive steps `@Set`/`@Reset` mutate $state entirely
  // inside the Renderer and never fire onAction; `@Run`/Query/Mutation need a
  // `toolProvider` we deliberately don't pass (Pebble has no direct tool access
  // in the browser — the agent owns tools). So we handle exactly two cases:
  //
  //  - open_url: a pure client navigation. Open it here; do NOT round-trip to
  //    the agent (the Renderer hands us the URL but does not open it, and
  //    humanFriendlyMessage is empty for this step).
  //  - everything else (continue_conversation / form submit): forward to Pebble's
  //    ui_action so the agent's pre_llm_call hook receives it as a structured
  //    envelope. `humanFriendlyMessage` is what the user effectively "said";
  //    form values ride along in `formState`.
  function handleAction(event: ActionEvent) {
    if (event.type === "open_url") {
      const url = event.params?.url;
      if (typeof url === "string" && url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    send({
      type: "ui_action",
      session_id: sessionId,
      action: event.humanFriendlyMessage || event.type,
      payload: {
        type: event.type,
        params: event.params ?? {},
        ...(event.formName ? { form: event.formName } : {}),
        ...(event.formState ? { values: event.formState } : {}),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Defensive: spec must be OpenUI Lang *text*. A non-string (e.g. a legacy
  // json-render `{root, elements}` object from an out-of-date agent plugin, or
  // old persisted history) would make <Renderer> render nothing silently — and
  // can break the surrounding turn. Detect it and show a clear notice instead.
  if (typeof spec !== "string" || spec.trim() === "") {
    return (
      <div className="agent-ui px-3 py-3 text-sm text-muted-foreground">
        This interactive block can't be displayed — the agent sent an
        unsupported UI format. Update the Pebble Hermes plugin so it emits
        OpenUI Lang.
      </div>
    );
  }

  const fallback = (
    <div className="agent-ui px-3 py-3 text-sm text-muted-foreground">
      This interactive block couldn't be rendered.
    </div>
  );

  return (
    <div className="agent-ui px-3 py-3">
      <RenderBoundary fallback={fallback}>
        <Renderer
          response={spec}
          library={openuiLibrary}
          isStreaming={false}
          onAction={handleAction}
        />
      </RenderBoundary>
    </div>
  );
}
