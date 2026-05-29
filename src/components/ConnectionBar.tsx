import { useState, useEffect } from "react";
import { useAppStore } from "../store";

export function ConnectionBar() {
  const wsStatus = useAppStore((s) => s.wsStatus);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const shouldShow = !isOnline || wsStatus === "reconnecting";
  const label = !isOnline ? "No connection" : "Reconnecting...";
  const color = !isOnline ? "bg-red-500" : "bg-amber-400";

  return (
    <div
      aria-hidden={!shouldShow}
      className={[
        "w-full overflow-hidden transition-all duration-500 ease-out",
        color,
        shouldShow ? "max-h-8 opacity-100" : "max-h-0 opacity-0",
      ].join(" ")}
    >
      <div
        className="flex items-center justify-center py-1 text-[11px] font-semibold text-white"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {label}
      </div>
    </div>
  );
}
