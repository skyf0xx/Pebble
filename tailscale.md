# Pebble + Tailscale: Mobile Agent Connectivity

## Why we're building this

Most AI agents today live inside messaging apps built for humans talking to humans — no streaming UI, no structured interactions, no task state. Pebble is agent-native from day one: sessions as tasks, generative UI inline, live status.

The missing piece is stable, frictionless connectivity from your phone to your agent running at home.

| Problem | Detail |
|---|---|
| Tunnels (Pinggy, ngrok) | URL changes on every restart — can't save a stable address |
| Cloudflare Quick Tunnels | No SSE support — blocks Hermes' streaming entirely |
| Raw local IP | Works on home wifi, breaks everywhere else |

---

## The solution: Tailscale free tier

Tailscale gives your laptop and phone a persistent private connection that works anywhere, across any network. No tunnel expiry. No URL to remember. No port forwarding. Hermes stays on localhost — Tailscale handles the rest, and **Hermes never needs to know Tailscale exists.**

**Free forever** for personal use: up to 3 users, 100 devices, all core features included (MagicDNS, subnet routing, exit nodes).

---

## Use Tailscale Serve, not the raw IP

Pebble is a PWA served over HTTPS. A secure page cannot `fetch()` a plain `http://100.x.x.x:8642` address — the browser blocks it as mixed content. So we don't use the raw tailnet IP. Instead, `tailscale serve` puts a real-TLS `https://<machine>.ts.net` address in front of localhost:

```bash
tailscale serve 8642
```

This is a one-time command on the agent's machine. It maps `https://<machine>.ts.net` → `localhost:8642`, with a valid certificate, reachable only from your own tailnet.

### Serve (private) vs Funnel (public) — the security tradeoff

| Mode | Reachable by | Token's role | TLS |
| --- | --- | --- | --- |
| **`tailscale serve`** (default, recommended) | only devices on **your** tailnet | second factor — backup to the network gate | ✅ |
| **`tailscale funnel`** (opt-in) | **anyone on the internet** with the URL | the **only** gate protecting your agent | ✅ |

**Default to Serve.** An attacker needs to be on your tailnet *and* know the token. A leaked token (logs, screenshots) isn't catastrophic because the URL still isn't routable off your tailnet. The cost: your phone must run Tailscale and be logged in.

**Funnel is the escape hatch** for "I don't want Tailscale on my phone." It's a public `*.ts.net` URL — same exposure profile as ngrok/Pinggy. The token becomes the entire security boundary, and bots scan the Funnel space, so background probing is expected. Only choose this knowingly. Pebble's setup screen warns about it.

---

## Setup flow

**One-time setup, ~5 minutes total.**

**1. Install Tailscale on the agent's computer**
Download and sign in at tailscale.com.

**2. Install Tailscale on your phone**
Same account. Both devices are now on a private mesh network — reachable from anywhere, on any network.

**3. Start Hermes**
Run as normal. Hermes listens on `localhost:8642` — nothing changes on the Hermes side.

**4. Expose it once**
Run `tailscale serve 8642` on the agent's computer. Note the `https://<machine>.ts.net` URL it prints.

**5. Connect Pebble once**
Open Pebble → the setup wizard walks through the above → paste the `https://<machine>.ts.net` URL + your API token → Pebble verifies it (`GET /api/sessions`) and saves it to localStorage.

**6. Done**
Anytime Tailscale is running on both devices, Pebble reaches your agent on launch — no link to paste again. SSE streaming works natively, no proxy.

---

## Pebble changes (implemented)

- **No more `?hermes=...&token=...` URL params.** Removed entirely. The setup wizard is the only entry point.
- **Persistent connection.** Saved to localStorage (`pebble_connection`), loaded on boot in `main.tsx`. Reconnects automatically.
- **`SetupScreen`** — a 4-step wizard (intro → install Tailscale → `tailscale serve 8642` → paste & verify). Replaces `EmptyScreen` (deleted).
- **`testConnection(baseUrl, token)`** in the Hermes adapter — probes `GET /api/sessions` and distinguishes unreachable host / bad token / other before saving.
- **`ConnectionSettingsDialog`** — gear in the chat list header → view the linked address, disconnect (clears the link, keeps chats).
- **Hermes is untouched.** It serves localhost as before and knows nothing about Tailscale.

### Connection status
Connection status displays as normal — the existing `ConnectingScreen` / error-retry states are unchanged.

## Why not the alternatives

| Option | Problem |
|---|---|
| Pinggy free | 60-minute tunnel expiry, URL changes each session |
| Pinggy Pro ($3/mo) | Persistent URL but adds a paid dependency |
| Cloudflare Quick Tunnel | No SSE support — hard blocker for Hermes streaming |
| Cloudflare account tunnel | Works but requires account setup and cloudflared binary |
| Raw LAN IP | Only works on home wifi |
| Raw tailnet IP (`http://100.x.x.x`) | Works on any network, but plain HTTP → blocked as mixed content from the HTTPS PWA |
| **Tailscale Serve** (`https://*.ts.net`) | ✅ Stable URL, real TLS, SSE works, private to your tailnet, free, ~5-minute setup |
