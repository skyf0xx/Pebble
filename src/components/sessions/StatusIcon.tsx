import { AlertCircle, Check, CircleHelp } from "lucide-react";
import type { SessionStatus } from "../../types";

interface StatusIconProps {
  status: SessionStatus;
}

export function StatusIcon({ status }: StatusIconProps) {
  if (status === "active") {
    return (
      <span className="flex items-center gap-[3px]">
        <span className="status-dot" style={{ animationDelay: "0ms" }} />
        <span className="status-dot" style={{ animationDelay: "160ms" }} />
        <span className="status-dot" style={{ animationDelay: "320ms" }} />
        <style>{`
          .status-dot {
            display: inline-block;
            width: 4px;
            height: 4px;
            border-radius: 9999px;
            background-color: #5C8A6B;
            animation: statusBounce 1.2s ease-in-out infinite;
          }
          @keyframes statusBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-3px); opacity: 1; }
          }
        `}</style>
      </span>
    );
  }

  if (status === "waiting") {
    return <CircleHelp size={22} color="#7A746D" strokeWidth={2} />;
  }

  if (status === "done") {
    return <Check size={18} color="#C1654A" strokeWidth={2.5} />;
  }

  // error
  return <AlertCircle size={18} color="#B85450" strokeWidth={2} />;
}
