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

Tailscale gives your laptop and phone a persistent private address that works anywhere, across any network. No tunnel expiry. No URL to remember. No port forwarding. The Pebble launcher stays on localhost — Tailscale handles the rest.

**Free forever** for personal use: up to 3 users, 100 devices, all core features included (MagicDNS, subnet routing, exit nodes).

---

## What gets exposed: the launcher, not Hermes

The Pebble launcher binary already serves the web app **and reverse-proxies `/api/*`, `/v1/*`, `/health` to Hermes on the same origin** (`http://localhost:5173`). The browser never makes a cross-origin request.

That means Tailscale only needs to expose **one port — 5173, the launcher**. Hermes stays on `localhost:8642`, untouched and unexposed. `tailscale serve 5173` puts both the app and the proxied API behind a single `https://host.ts.net` origin:

- **Same origin** → no CORS, no mixed-content (the PWA is HTTPS and the API is HTTPS, same host).
- **Real TLS cert** from Tailscale → no certificate warnings, SSE streams natively.
- **The API key still gates `/api`** → exposing the launcher doesn't expose your agent without the token.

> Do **not** `tailscale serve 8642` (Hermes directly). That puts the API on a different origin from the app, reintroducing CORS, and skips the launcher's proxy. Always expose 5173.

---

## Setup flow

**One-time setup, ~5 minutes total.**

**1. Install Tailscale on laptop**
Download and sign in at tailscale.com.

**2. Install Tailscale on phone**
Use the same account. Both devices are now on a private mesh network — reachable from anywhere, on any network.

**3. Start the Pebble launcher on laptop**
`~/.hermes/bin/pebble`. It serves on `localhost:5173` and proxies to Hermes. Nothing changes on the Hermes side.

**4. Expose the launcher over Tailscale**
```bash
tailscale serve 5173
# → https://<your-host>.ts.net  (app + proxied API, one origin, real TLS)
```

**5. Connect Pebble once**
Open Pebble, follow the setup wizard, paste `https://<your-host>.ts.net` and your API token. Pebble verifies (`GET /api/sessions`) and saves it to localStorage permanently.

**6. Done**
Anytime Tailscale is running on both devices, Pebble reaches your agent. SSE streaming works natively — no proxy of our own, no workarounds.

---

## Private (Serve) vs public (Funnel): the security tradeoff

Tailscale offers two ways to expose the port. They have very different threat models.

| | `tailscale serve` (private) | `tailscale funnel` (public) |
|---|---|---|
| URL | `https://host.ts.net` | `https://host.ts.net` |
| Reachable by | only devices on **your tailnet** | **anyone on the internet** |
| Token's role | second factor (behind the tailnet) | the **only** gate |
| Phone needs Tailscale | yes | no |
| TLS | ✅ real cert | ✅ real cert |

**Default to Serve (private).** An attacker needs to be *on your tailnet* (own a device you authorized) **and** know the token — defense in depth. A leaked token (logs, a screenshot) isn't catastrophic because the URL still isn't routable off your tailnet. The cost: your phone must run Tailscale, logged into the same account.

**Funnel is the opt-in escape hatch** for "I don't want Tailscale on my phone." It works from any browser instantly — but the API key becomes the *entire* security boundary, same exposure profile as a public tunnel. Bots scan the Funnel address space, so expect background probing. Only use it if the token check is enforced before any work happens, and treat that token (and the QR that contains it) like a password.

---

## The "Open on phone" QR

The desktop session-list header shows a QR for moving a connection to your phone. It encodes a `#connect=` **deep-link** carrying the connection in the URL *fragment* (never sent to a server or written to logs). The phone scans it → opens Pebble → verifies → saves → scrubs the link from the URL.

This means one-scan setup for a second device: set up on the laptop, scan to bring it to your phone. The token does live inside the QR image, so a screenshot/photo of it contains the token — fine as a second factor behind a private Serve tailnet, but treat it carefully under Funnel.

---

## Pebble changes (done)

- Connection is configured via the `SetupScreen` wizard and persisted to localStorage — the old `?hermes=&token=` URL params are gone (Pebble ignores them).
- Boot reads two sources: a saved config, or a `#connect=` QR deep-link (verified before saving, then scrubbed from the URL).
- The "Open on phone" QR encodes the connection so a second device auto-connects.

> Note: the launcher binary still prints a `?hermes=...` launch URL. Those params are inert now — Pebble ignores them. The binary (source outside this repo) should be updated to print the bare `http://localhost:5173`.

---

## Why not the alternatives

| Option | Problem |
|---|---|
| Pinggy free | 60-minute tunnel expiry, URL changes each session |
| Pinggy Pro ($3/mo) | Persistent URL but adds a paid dependency |
| Cloudflare Quick Tunnel | No SSE support — hard blocker for Hermes streaming |
| Cloudflare account tunnel | Works but requires account setup and cloudflared binary |
| Raw LAN IP | Only works on home wifi; plain HTTP → mixed-content blocked in the PWA |
| **Tailscale free** | ✅ Stable URL, real TLS, SSE works, free, ~5-minute setup |
