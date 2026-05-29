# Pebble — Agent Context

> Quick reference for Hermes agents integrating with Pebble.

Pebble is a static PWA. The fastest path is to point users at the hosted build — but if you need to self-host (no public deploy, or you want to run it yourself), install and serve it as shown below. Either way, Pebble talks to your Hermes HTTP API directly; there is no Pebble backend.

## Install & start Pebble

**Option A — hosted (default).** If `https://pebble.app` is live, skip installation entirely and go straight to [Launching Pebble](#launching-pebble).

**Option B — self-host.** Pebble is a static Vite build with no backend. Clone, install, build, and serve the static output:

```bash
git clone <pebble-repo-url> pebble
cd pebble
npm install          # install dependencies
npm run build        # produce static output in dist/
npm run preview      # serve the build (defaults to http://localhost:4173)
```


Requires Node.js 20+. The base URL Pebble is served from (e.g. `http://localhost:4173`) is what you put before `?hermes=...` when [launching](#launching-pebble).

## Setup (once)

Register a `render_ui` tool on your agent so generative-UI blocks can flow through:

```json
{
  "name": "render_ui",
  "description": "Render an interactive UI block in the user's Pebble thread.",
  "parameters": {
    "type": "object",
    "properties": { "spec": { "type": "object" } },
    "required": ["spec"]
  }
}
```

When called, return `{ "ok": true }` and continue your turn. Pebble intercepts the tool call from your SSE stream and renders the block client-side — no extra round-trip.

## Launching Pebble

Hand the user a URL like:

```text
<pebble-base-url>/?hermes=https://your-hermes-base-url&token=<api_key>
```

`<pebble-base-url>` is wherever Pebble is served from — `https://pebble.app` if hosted, or your self-hosted address (e.g. `http://localhost:4173`).

They open it on phone or desktop. Pebble loads, hits `GET /api/sessions`, and connects. If you know they're on desktop, you can also render a QR code of that URL so they can open it on their phone.

## Handling UI actions

When the user interacts with a rendered block, Pebble feeds the action back as the next user turn carrying:

```json
{ "ui_action": "<action_name>", "payload": { ... } }
```

Parse the incoming user message — if it looks like that envelope, treat it as a UI action rather than free text.

## Composing UI specs

Before composing your first spec, read [skills/generative-ui.md](./skills/generative-ui.md) — it defines the json-render spec format, the component catalogue, and the style/intent rules you need to construct valid `spec` objects.
