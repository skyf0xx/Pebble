import { useState } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { LogOut, Link2, ShieldCheck } from "lucide-react";

const FONT = "'Plus Jakarta Sans', sans-serif";

interface Props {
  open: boolean;
  onClose: () => void;
  hermesUrl: string;
  /** Forget the saved connection and return to the setup wizard. */
  onDisconnect: () => void;
}

/**
 * Lightweight connection settings — reachable from the chat list's gear. Shows
 * the agent Pebble is currently linked to and lets the user disconnect, which
 * clears the saved Tailscale link and drops them back into SetupScreen. Chats
 * stay on the device; only the connection is forgotten.
 */
export function ConnectionSettingsDialog({ open, onClose, hermesUrl, onDisconnect }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleClose = () => {
    setConfirming(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-white dark:bg-[#1C1917] border border-[#e2e8f0] dark:border-[#3C3836] rounded-2xl p-6 shadow-xl">
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-[#1e1e2e] dark:text-[#F5F0EB] tracking-tight" style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700 }}>
              Connection
            </h2>
            <p className="text-[#757780] dark:text-[#A8A29E]" style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500 }}>
              Pebble is linked to your agent at this address.
            </p>
          </div>

          <div className="flex items-start gap-3 bg-[#f8f9fa] dark:bg-[#292524] border border-[#e2e8f0] dark:border-[#3C3836] rounded-xl px-4 py-3">
            <Link2 size={16} className="text-[#3B82F6] shrink-0 mt-0.5" />
            <code className="text-[#1e1e2e] dark:text-[#F5F0EB] break-all" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
              {hermesUrl || "Not connected"}
            </code>
          </div>

          <div className="flex items-start gap-2.5 px-1">
            <ShieldCheck size={15} className="text-[#757780] dark:text-[#A8A29E] shrink-0 mt-0.5" />
            <p className="text-[#757780] dark:text-[#A8A29E]" style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 500, lineHeight: 1.5 }}>
              Reachable over your Tailscale network. Disconnecting forgets this link — your chats stay on this device.
            </p>
          </div>

          {confirming ? (
            <div className="space-y-2">
              <p className="text-[#1e1e2e] dark:text-[#F5F0EB] text-center" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
                Disconnect from this agent?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-full py-3 px-4 border border-[#e2e8f0] dark:border-[#3C3836] text-[#1e1e2e] dark:text-[#F5F0EB] hover:bg-[#f8f9fa] dark:hover:bg-[#292524] active:scale-[0.98] transition-all"
                  style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDisconnect();
                    handleClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 px-4 bg-[#dc2626] text-white hover:bg-[#b91c1c] active:scale-[0.98] transition-all"
                  style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}
                >
                  <LogOut size={15} />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full flex items-center justify-center gap-2 rounded-full py-3 px-4 border border-[#fecaca] dark:border-[#5a3535] text-[#dc2626] dark:text-[#fca5a5] hover:bg-[#fef2f2] dark:hover:bg-[#3a2424] active:scale-[0.98] transition-all"
              style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}
            >
              <LogOut size={15} />
              Disconnect
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
