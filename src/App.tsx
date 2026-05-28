import { useEffect } from "react";
import { useAppStore } from "./store";
import { connect, disconnect } from "./lib/ws";
import { EmptyScreen } from "./components/EmptyScreen";
import { ConnectingScreen } from "./components/ConnectingScreen";
import { Layout } from "./components/Layout";

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

function App() {
  const wsUrl = useAppStore((s) => s.wsUrl);
  const wsStatus = useAppStore((s) => s.wsStatus);
  const setSessions = useAppStore((s) => s.setSessions);

  useEffect(() => {
    setSessions(MOCK_SESSIONS);
  }, [setSessions]);

  useEffect(() => {
    if (!wsUrl) return;
    connect(wsUrl);
    return () => disconnect();
  }, [wsUrl]);

  if (!wsUrl) {
    return <EmptyScreen />;
  }

  if (wsStatus === "connecting" || wsStatus === "reconnecting") {
    return <ConnectingScreen />;
  }

  if (wsStatus === "disconnected") {
    return <ConnectingScreen error onRetry={() => connect(wsUrl)} />;
  }

  return <Layout />;
}

export default App;
