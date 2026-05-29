// Mirrors src/types.ts in the PWA. Keep in sync if the protocol changes.

export type SessionStatus = "active" | "waiting" | "done" | "error";

export interface SessionMeta {
  session_id: string;
  label: string;
  status: SessionStatus;
  last_message: string;
  last_updated: string;
  unread: number;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "agent";
  kind: "thought" | "message";
  content: string;
  timestamp: string;
  streaming?: boolean;
  uiSpec?: Record<string, unknown>;
}

export type AgentUISpec = Record<string, unknown>;

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
    }
  | { type: "ping" };

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
  | {
      type: "agent_push";
      session_id: string | null;
      content?: string;
      spec?: AgentUISpec;
      priority: "low" | "normal" | "high";
    }
  | { type: "pong" }
  | { type: "error"; code: string; message: string; session_id?: string };
