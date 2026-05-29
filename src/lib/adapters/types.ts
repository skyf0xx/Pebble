import type { AgentMessage, ClientMessage } from "../../types";

/**
 * A HostAdapter normalises a specific agent host's API into Pebble's internal
 * AgentMessage vocabulary so the store and UI never need to know which
 * transport is in use. Currently there's only the Hermes adapter, but the
 * interface is kept so a second host can be added without touching components.
 */
export interface HostAdapter {
  connect(): Promise<void>;
  disconnect(): void;
  send(msg: ClientMessage): void;
  onEvent(handler: (msg: AgentMessage) => void): void;
  onStatus(handler: (status: AdapterStatus) => void): void;
}

export type AdapterStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";
