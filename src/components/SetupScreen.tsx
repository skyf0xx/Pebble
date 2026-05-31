import { useState } from "react";
import { ArrowRight, ArrowLeft, Check, Copy, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { avatars } from "../lib/avatars";
import { testConnection, saveAndConnect } from "../lib/connection";

/**
 * First-run setup wizard. Pebble has no backend and no ?hermes= URL params — the
 * user reaches their home agent over Tailscale. Hermes itself knows nothing
 * about Tailscale: it serves on localhost as usual, the user runs
 * `tailscale serve 8642` once at the OS level, and pastes the resulting
 * https://host.ts.net URL here. We verify it against GET /api/sessions before
 * saving so a typo or a stopped agent surfaces immediately, not on first chat.
 *
 * Steps: intro → install Tailscale → expose the agent → paste & verify.
 */

const HERMES_PORT = 8642;
const SERVE_CMD = `tailscale serve ${HERMES_PORT}`;

const FONT = "'Plus Jakarta Sans', sans-serif";

type Step = 0 | 1 | 2 | 3;

export function SetupScreen() {
  const [step, setStep] = useState<Step>(0);

  return (
    <div className="min-h-svh bg-white dark:bg-[#1C1917] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#adc6ff]/20 rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#F97316]/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

      <main className="relative z-10 w-full max-w-md flex flex-col">
        <StepDots step={step} />
        <div className="mt-8">
          {step === 0 && <Intro onNext={() => setStep(1)} />}
          {step === 1 && <InstallStep onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <ExposeStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <ConnectStep onBack={() => setStep(2)} />}
        </div>
      </main>
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === step ? 24 : 8,
            backgroundColor: i <= step ? "#3B82F6" : "#e2e8f0",
          }}
        />
      ))}
    </div>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center space-y-3">
      <h1
        className="text-[#1e1e2e] dark:text-[#F5F0EB] tracking-tight"
        style={{ fontFamily: FONT, fontSize: 28, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" }}
      >
        {title}
      </h1>
      <p className="text-[#757780] dark:text-[#A8A29E] leading-relaxed" style={{ fontFamily: FONT, fontSize: 16, fontWeight: 500 }}>
        {body}
      </p>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 bg-[#3B82F6] text-white rounded-full py-3.5 px-6 shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
      style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}
    >
      {children}
    </button>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center justify-center gap-1.5 text-[#757780] dark:text-[#A8A29E] hover:text-[#1e1e2e] dark:hover:text-[#F5F0EB] py-2 transition-colors"
      style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600 }}
    >
      <ArrowLeft size={15} />
      Back
    </button>
  );
}

function Intro({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#3B82F6]/10 blur-2xl opacity-60 animate-pulse pointer-events-none" />
        <div className="absolute inset-4 rounded-full bg-[#f2f3fd] dark:bg-[#3C3836] border-4 border-white dark:border-[#292524] shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center">
          <img src={avatars.pebble} alt="" aria-hidden="true" className="w-24 h-24 object-contain" />
        </div>
      </div>
      <Heading
        title="Connect to your agent"
        body="Pebble talks directly to your agent at home. We'll use Tailscale to reach it securely from anywhere — about two minutes, once."
      />
      <div className="w-full space-y-3">
        <PrimaryButton onClick={onNext}>
          Get started
          <ArrowRight size={16} />
        </PrimaryButton>
      </div>
    </div>
  );
}

function InstallStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-7">
      <Heading
        title="Install Tailscale"
        body="Tailscale gives your phone and your agent's computer a private connection that works on any network — no public URL, no port forwarding."
      />
      <ol className="space-y-3">
        <NumberedItem n={1}>
          On the computer running your agent, install Tailscale from{" "}
          <a href="https://tailscale.com/download" target="_blank" rel="noreferrer" className="text-[#3B82F6] font-semibold underline-offset-2 hover:underline">
            tailscale.com/download
          </a>{" "}
          and sign in.
        </NumberedItem>
        <NumberedItem n={2}>
          Install Tailscale on <strong>this device</strong> too and sign in with the same account.
        </NumberedItem>
      </ol>
      <div className="space-y-2">
        <PrimaryButton onClick={onNext}>
          Both installed
          <ArrowRight size={16} />
        </PrimaryButton>
        <BackLink onBack={onBack} />
      </div>
    </div>
  );
}

function ExposeStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-7">
      <Heading
        title="Expose your agent"
        body="On the agent's computer, run this once. It gives your agent a stable https:// address on your private network."
      />
      <CommandBox command={SERVE_CMD} />
      <p
        className="text-center text-[#a0a3ad] dark:text-[#78716c] leading-relaxed -mt-3"
        style={{ fontFamily: FONT, fontSize: 13 }}
      >
        It prints a <strong>https://your-machine.ts.net</strong> URL. Keep it handy for the next step.
      </p>
      <div className="space-y-2">
        <PrimaryButton onClick={onNext}>
          I have the URL
          <ArrowRight size={16} />
        </PrimaryButton>
        <BackLink onBack={onBack} />
      </div>
    </div>
  );
}

function ConnectStep({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canVerify = url.trim().length > 0 && !verifying;

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    const result = await testConnection(url, token);
    if (result.ok) {
      // Persist + flip the store to connecting; App.tsx takes over from here.
      saveAndConnect({ hermes: url, token: token.trim() || undefined });
      return; // component unmounts as the gate advances
    }
    setError(result.error ?? "Couldn't connect. Check the URL and token.");
    setVerifying(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <Heading title="Paste your link" body="Enter the Tailscale URL and your agent's API token. We'll verify it before saving." />

      <div className="space-y-4">
        <Field label="Agent URL">
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-machine.ts.net"
            className="w-full bg-white dark:bg-[#292524] border border-[#e2e8f0] dark:border-[#3C3836] rounded-xl py-3 px-4 text-[15px] text-[#1e1e2e] dark:text-[#F5F0EB] placeholder:text-[#a0a3ad] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 transition-all"
            style={{ fontFamily: FONT }}
          />
        </Field>
        <Field label="API token">
          <input
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Your agent's API key"
            className="w-full bg-white dark:bg-[#292524] border border-[#e2e8f0] dark:border-[#3C3836] rounded-xl py-3 px-4 text-[15px] text-[#1e1e2e] dark:text-[#F5F0EB] placeholder:text-[#a0a3ad] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 transition-all"
            style={{ fontFamily: FONT }}
            onKeyDown={(e) => e.key === "Enter" && canVerify && handleVerify()}
          />
        </Field>
      </div>

      {error && (
        <div
          className="flex items-start gap-2.5 bg-[#fef2f2] dark:bg-[#3a2424] border border-[#fecaca] dark:border-[#5a3535] rounded-xl px-4 py-3"
          style={{ fontFamily: FONT }}
        >
          <TriangleAlert size={16} className="text-[#dc2626] shrink-0 mt-0.5" />
          <p className="text-[#b91c1c] dark:text-[#fca5a5]" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>
            {error}
          </p>
        </div>
      )}

      <PrivacyNote token={token} />

      <div className="space-y-2">
        <PrimaryButton onClick={handleVerify} disabled={!canVerify}>
          {verifying ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <Check size={16} />
              Verify & connect
            </>
          )}
        </PrimaryButton>
        <BackLink onBack={onBack} />
      </div>
    </div>
  );
}

/**
 * Tells the user, calmly, what their token is protecting. A Tailscale Serve URL
 * (private) is only reachable from their own tailnet, so the token is a second
 * factor. A Funnel URL (public *.ts.net) is reachable by anyone, so the token is
 * the *only* gate — worth flagging. We detect Funnel best-effort by hostname.
 */
function PrivacyNote({ token }: { token: string }) {
  // Heuristic only — Serve and Funnel share the *.ts.net host, so we can't truly
  // tell them apart client-side. We surface the general principle either way.
  const hasToken = token.trim().length > 0;
  return (
    <div className="flex items-start gap-2.5 px-1" style={{ fontFamily: FONT }}>
      <ShieldCheck size={15} className="text-[#757780] dark:text-[#A8A29E] shrink-0 mt-0.5" />
      <p className="text-[#757780] dark:text-[#A8A29E]" style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.5 }}>
        With Tailscale Serve, only your own devices can reach this address.{" "}
        {hasToken
          ? "Your token adds a second layer on top."
          : "If you used Funnel (a public link), the token is the only thing protecting your agent — don't skip it."}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[#757780] dark:text-[#A8A29E] px-1" style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberedItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="shrink-0 w-6 h-6 rounded-full bg-[#f2f3fd] dark:bg-[#3C3836] text-[#3B82F6] flex items-center justify-center"
        style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700 }}
      >
        {n}
      </span>
      <span className="text-[#1e1e2e] dark:text-[#F5F0EB] leading-relaxed pt-0.5" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 500 }}>
        {children}
      </span>
    </li>
  );
}

function CommandBox({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the user can still select the text manually */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 bg-[#1e1e2e] dark:bg-[#0f0e15] rounded-xl px-4 py-3.5">
      <code className="text-[#e2e8f0] truncate" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
        {command}
      </code>
      <button
        onClick={copy}
        className="shrink-0 flex items-center gap-1.5 text-[#a0a3ad] hover:text-white transition-colors"
        style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600 }}
        aria-label="Copy command"
      >
        {copied ? <Check size={15} className="text-[#4ade80]" /> : <Copy size={15} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
