import { spawn, type ChildProcess } from "node:child_process";

// cloudflared prints a line like:
//   |  https://<random>.trycloudflare.com  |
// on stderr when --url is used. We capture the first match.
const TUNNEL_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export interface Tunnel {
  url: string;
  proc: ChildProcess;
}

const procs = new Set<ChildProcess>();

export function startTunnel(localPort: number, timeoutMs = 20_000): Promise<Tunnel> {
  return new Promise((resolve, reject) => {
    let proc: ChildProcess;
    try {
      proc = spawn(
        "cloudflared",
        ["tunnel", "--no-autoupdate", "--url", `http://localhost:${localPort}`],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (err) {
      reject(
        new Error(
          `cloudflared not found on PATH. Install it and retry. (${(err as Error).message})`,
        ),
      );
      return;
    }

    procs.add(proc);

    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
      reject(new Error("Timed out waiting for cloudflared tunnel URL"));
    }, timeoutMs);

    const onData = (chunk: Buffer | string) => {
      const s = chunk.toString();
      const match = s.match(TUNNEL_URL_RE);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ url: match[0], proc });
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);

    proc.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(
        new Error(
          `Failed to spawn cloudflared: ${err.message}. Ensure it's installed (brew install cloudflared).`,
        ),
      );
    });

    proc.on("exit", (code) => {
      procs.delete(proc);
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(new Error(`cloudflared exited (code ${code}) before printing a URL`));
    });
  });
}

export async function stopAllTunnels(): Promise<void> {
  for (const p of procs) {
    try {
      p.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  procs.clear();
}
