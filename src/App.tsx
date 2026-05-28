import { useEffect } from "react";
import { useAppStore } from "./store";
import { connect, disconnect } from "./lib/ws";

function App() {
  const wsUrl = useAppStore((s) => s.wsUrl);

  useEffect(() => {
    if (!wsUrl) return;
    connect(wsUrl);
    return () => disconnect();
  }, [wsUrl]);

  return (
    <div className="min-h-svh bg-background text-foreground flex items-center justify-center">
      <p className="text-muted-foreground font-sans">Pebble</p>
    </div>
  );
}

export default App;
