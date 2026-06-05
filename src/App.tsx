import { useEffect } from "react";
import { useAppStore } from "./store";
import {
  connect,
  disconnect,
  originConnectCandidate,
  saveAndConnect,
  submitPassphrase,
} from "./lib/connection";
import { useHashRoute } from "./lib/useHashRoute";
import { SetupScreen } from "./components/SetupScreen";
import { ConnectingScreen } from "./components/ConnectingScreen";
import { PassphraseScreen } from "./components/PassphraseScreen";
import { Layout } from "./components/Layout";
import type { Message } from "./types";

const IS_MOCK = new URLSearchParams(window.location.search).has("mock");

const MOCK_SESSIONS = [
  {
    session_id: "s-active-01",
    label: "Plan weekend trip",
    status: "active" as const,
    last_message: "Let's look at some flights to...",
    last_updated: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    unread: 2,
  },
  {
    session_id: "s-waiting-02",
    label: "Vet Appointment",
    status: "waiting" as const,
    last_message: "Dr. Smith needs confirmation",
    last_updated: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    unread: 1,
  },
  {
    session_id: "s-done-03",
    label: "Dinner recipes",
    status: "done" as const,
    last_message: "I need a good pasta recipe...",
    last_updated: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    unread: 0,
  },
  {
    session_id: "s-error-04",
    label: "Debug python script",
    status: "error" as const,
    last_message: "The error says index out of...",
    last_updated: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    unread: 0,
  },
];

const MOCK_MESSAGES: Message[] = [
  {
    id: "m-01",
    session_id: "s-active-01",
    role: "user",
    kind: "message",
    content: "Hey! I'm thinking about a quick weekend trip. Maybe somewhere warm? Got any quick ideas?",
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: "m-02",
    session_id: "s-active-01",
    role: "agent",
    kind: "thought",
    content: "User wants a warm weekend destination. Should suggest somewhere reachable within a few hours. Beach or city break?",
    timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
  },
  {
    id: "m-03",
    session_id: "s-active-01",
    role: "agent",
    kind: "message",
    content: "Hello there! I'd love to help. Warm sounds perfect right now. How about we look at some spots in Florida or maybe Southern California? Are you looking for a beach vibe or more of a city exploration?",
    timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
  },
  {
    id: "m-04",
    session_id: "s-active-01",
    role: "user",
    kind: "message",
    content: "Definitely a beach vibe. Something relaxing.",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "m-05",
    session_id: "s-active-01",
    role: "agent",
    kind: "message",
    content: "I found a great option — Clearwater Beach in Florida. Want me to book it?",
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    // OpenUI Lang (column-oriented Table + a Buttons row). Buttons with no
    // explicit Action auto-send their label back to the assistant.
    uiSpec: [
      'root = Stack([options, actions])',
      'options = Table([Col("Option", names), Col("Price/night", prices), Col("Rating", ratings, "number")])',
      'names = ["Clearwater Beach, FL", "Siesta Key, FL", "Gulf Shores, AL"]',
      'prices = ["$180", "$210", "$145"]',
      'ratings = [4.7, 4.8, 4.5]',
      'actions = Buttons([approve, reject])',
      'approve = Button("Yes, book it!", null, "primary")',
      'reject = Button("Not yet", null, "secondary")',
    ].join("\n"),
  },
];

function App() {
  const wsUrl = useAppStore((s) => s.wsUrl);
  const wsStatus = useAppStore((s) => s.wsStatus);
  const authRequired = useAppStore((s) => s.authRequired);
  const connectionConfig = useAppStore((s) => s.connectionConfig);

  // Keep the browser URL in sync with the open chat (#/session/:id).
  useHashRoute();

  // Unlock the passphrase gate, then resume the normal connect flow. The cookie
  // is now set, so either the saved config connects, or — on the boot-401 path
  // where nothing was persisted yet — we commit the origin candidate.
  async function handleUnlock(passphrase: string): Promise<boolean> {
    const ok = await submitPassphrase(passphrase);
    if (!ok) return false;
    const store = useAppStore.getState();
    store.setAuthRequired(false);
    if (store.connectionConfig) {
      connect(store.connectionConfig);
    } else {
      const candidate = originConnectCandidate();
      if (candidate) saveAndConnect(candidate);
    }
    return true;
  }

  useEffect(() => {
    if (!IS_MOCK) return;
    const { setWsUrl, setWsStatus, setSessions, upsertMessage } = useAppStore.getState();
    setWsUrl("mock");
    setWsStatus("connected");
    setSessions(MOCK_SESSIONS);
    MOCK_MESSAGES.forEach((m) => upsertMessage(m.session_id, m));
  }, []);

  useEffect(() => {
    if (IS_MOCK || !connectionConfig) return;
    connect(connectionConfig);
    return () => disconnect();
  }, [connectionConfig]);

  // Outermost gate: the launcher's passphrase. Shown ahead of the wizard so a
  // 401 (gate on, not yet unlocked) asks for the passphrase rather than walking
  // Tailscale setup. The deep-linked hash is untouched, so unlocking lands on
  // the chat you opened.
  if (authRequired) {
    return <PassphraseScreen onSubmit={handleUnlock} />;
  }

  if (!wsUrl) {
    return <SetupScreen />;
  }

  if (wsStatus === "connecting" || wsStatus === "reconnecting") {
    return <ConnectingScreen />;
  }

  if (wsStatus === "disconnected") {
    return (
      <ConnectingScreen
        error
        onRetry={() => connectionConfig && connect(connectionConfig)}
      />
    );
  }

  return <Layout />;
}

export default App;
