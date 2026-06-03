// Session

export type SessionStatus = "active" | "waiting" | "done" | "error";

export interface SessionMeta {
  session_id: string;
  label: string;
  /**
   * True while the label is an auto-derived placeholder (from the user's first
   * message, or the agent's first reply) that a better title may still replace.
   * An explicit agent `label` (or a user edit) clears this — that title is final
   * and won't be auto-overwritten.
   */
  labelProvisional?: boolean;
  status: SessionStatus;
  last_message: string;
  last_updated: string; // ISO8601
  unread: number;
}

// Messages

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "agent";
  kind: "thought" | "message";
  content: string;
  timestamp: string; // ISO8601
  streaming?: boolean;
  uiSpec?: AgentUISpec;
}

// Agent-pushed generative UI — OpenUI Lang source text (rendered by AgentUIBlock
// via @openuidev/react-lang's <Renderer>). Was a json-render JSON spec object.
export type AgentUISpec = string;

// Internal: client → adapter

export type ClientMessage =
  | { type: "session_create"; label?: string }
  | { type: "session_resume"; session_id: string }
  | { type: "session_delete"; session_id: string }
  | {
      type: "user_message";
      session_id: string;
      content: string;
      timestamp: string;
    }
  | {
      type: "ui_action";
      session_id: string;
      action: string;
      payload: Record<string, unknown>;
      timestamp: string;
    };

// Internal: adapter → store

export type AgentMessage =
  | { type: "session_list"; sessions: SessionMeta[] }
  | { type: "session_history"; session_id: string; messages: Message[] }
  | {
      type: "agent_message";
      session_id: string;
      message_id: string;
      kind: "thought" | "message";
      content: string;
      streaming: boolean;
      timestamp: string;
    }
  | {
      type: "agent_ui";
      session_id: string;
      message_id: string;
      spec: AgentUISpec;
      timestamp: string;
    }
  | {
      type: "session_status";
      session_id: string;
      status: SessionStatus;
      label?: string;
    }
  | { type: "error"; code: string; message: string; session_id?: string };
