import { useState, useEffect } from "react";
import { X } from "lucide-react";

type Platform = "ios" | "android" | null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return null;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
});

export function AddToHomeScreen() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem("pebble-aths-dismissed")) return;

    const p = detectPlatform();
    if (!p) return;

    setPlatform(p);
    setVisible(true);

    // Upgrade to native prompt if/when available
    if (p === "android" && !deferredPrompt) {
      const handler = () => {
        // Re-render to pick up deferredPrompt for the install button
        setPlatform("android");
      };
      window.addEventListener("beforeinstallprompt", handler, { once: true });
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem("pebble-aths-dismissed", "1");
  }

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 bg-[#FDF6F2] border-t border-[#F0E6DF] text-[#1e1e2e] shrink-0"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug">Add Pebble to your home screen</p>
        {platform === "ios" ? (
          <p className="text-[12px] text-[#757780] mt-0.5 leading-snug">
            Tap <span className="font-semibold">Share</span> then <span className="font-semibold">Add to Home Screen</span>
          </p>
        ) : deferredPrompt ? (
          <button
            onClick={handleAndroidInstall}
            className="mt-1 text-[12px] font-semibold text-[#C1654A] underline underline-offset-2"
          >
            Install app
          </button>
        ) : (
          <p className="text-[12px] text-[#757780] mt-0.5 leading-snug">
            Tap <span className="font-semibold">⋮ Menu</span> then <span className="font-semibold">Add to Home Screen</span>
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="mt-0.5 text-[#a0a3ad] hover:text-[#757780] transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
