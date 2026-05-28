import { useEffect } from "react";
import { useAppStore } from "./store";
import { connect, disconnect } from "./lib/ws";
import { EmptyScreen } from "./components/EmptyScreen";
import { ConnectingScreen } from "./components/ConnectingScreen";

function App() {
  const wsUrl = useAppStore((s) => s.wsUrl);
  const wsStatus = useAppStore((s) => s.wsStatus);

  useEffect(() => {
    if (!wsUrl) return;
    connect(wsUrl);
    return () => disconnect();
  }, [wsUrl]);

  if (!wsUrl) return <EmptyScreen />;

  if (wsStatus === "connecting" || wsStatus === "reconnecting") {
    return <ConnectingScreen />;
  }

  if (wsStatus === "disconnected") {
    return <ConnectingScreen error onRetry={() => connect(wsUrl)} />;
  }

  return (
    <div className="min-h-svh bg-white text-[#1e1e2e] flex items-center justify-center">
      <p className="text-[#757780]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Pebble</p>
    </div>
  );
}

export default App;
