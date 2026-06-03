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

// OpenUI Lang renderer. The agent emits openui-lang source (see the Hermes
// plugin's pebble-protocol-ui SKILL) and we render it with @openuidev's built-in
// component library. No spec normalization is needed — Lang is parsed and
// validated by the renderer itself, which replaces the json-render coercion
// machinery this component used to carry.
export function AgentUIBlock({ spec, sessionId }: AgentUIBlockProps) {
  // Every interactive element (a Button's @ToAssistant, an explicit Action,
  // a form submit) surfaces here. We forward it to Pebble's ui_action so the
  // agent's pre_llm_call hook receives it as a structured envelope — the same
  // contract the json-render renderer used. `humanFriendlyMessage` is the label
  // the user effectively "said"; form values ride along in `formState`.
  function handleAction(event: ActionEvent) {
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

  return (
    <div className="agent-ui px-3 py-3">
      <Renderer
        response={spec}
        library={openuiLibrary}
        isStreaming={false}
        onAction={handleAction}
      />
    </div>
  );
}
