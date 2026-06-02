---
name: pebble-protocol-ui
description: Component catalogue for Pebble `pebble_send` type "ui" blocks — the components, props, and stateless interaction model. View when building an interactive UI block.
category: integrations
tags: [pebble, hermes, ui, json-render, components]
---

# Pebble UI component catalogue

Reference for building `pebble_send` type `"ui"` blocks. The protocol itself
(message/ui/status/push, button intents, element-id rules, the `ui_action`
round-trip) lives in `pebble:pebble-protocol` — view that first if you haven't.

A `ui` spec is `{ "root": "<id>", "elements": { "<id>": <element>, ... } }`.
Each element has a `type` (from this list), a `props` object, and — for
containers — a `children` array of element ids. Buttons add an `on` map.

## The stateless model (read this first)

Pebble's UI keeps **no client-side form state**. Every interaction round-trips
back to you as a `ui_action`. So **all interactivity comes from buttons** — to
collect a choice, render the options as buttons and read the `action` that comes
back. The display components below are for *showing* information; they don't send
anything back.

This is why there is no `Input`/`Select`/`Checkbox`/`Radio`/`Switch`/`Slider`
in the list below: those depend on two-way state binding that Pebble doesn't
track, so their values never reach you. If you need free-text, ask in a
`message` and let the user type a normal reply.

## Layout & structure

- **Stack** — flex container. `props: { direction: "horizontal"|"vertical", gap: "sm"|"md"|"lg", align?, justify? }`, `children: [...]`. Your default wrapper.
- **Grid** — grid layout. `props: { columns: <number>, gap }`, `children: [...]`.
- **Card** — bordered container. `props: { title?, description?, maxWidth?, centered? }`, `children: [...]`. Good for grouping a block of related info.
- **Separator** — visual divider. `props: { orientation?: "horizontal"|"vertical" }`.

## Display (read-only — show information)

- **Heading** — `props: { level: "h1"|"h2"|"h3"|"h4", text? }` (or text as a child).
- **Text** — paragraph. `props: { variant?: "body"|"caption"|"muted"|"lead"|"code" }`, text as child.
- **Badge** — small status tag. `props: { text, variant?: "default"|"secondary"|"destructive"|"outline" }`.
- **Alert** — callout banner. `props: { title, message, type: "success"|"warning"|"info"|"error" }`. Use for warnings or important notices.
- **Table** — `props: { columns: string[], rows: string[][] }`. `columns` is header **strings**; `rows` is a **2D array of cell strings**. Do *not* emit `columns: [{"key":...,"label":...}]` or row objects keyed by column — those render an empty table body (header only).
- **Progress** — progress bar. `props: { value: <number>, max?: <number>, label? }`. Useful in a `push` reporting background-task progress.
- **Avatar** — `props: { src, name, size? }`.
- **Image** — `props: { src, alt, width?, height? }`.
- **Link** — `props: { label, href }`. Opens a URL; does not send a `ui_action`.

## Interactive (send a `ui_action` back)

- **Button** — the primary input. `props: { label, intent?: "confirm"|"dismiss"|"destructive", disabled? }`, `on: { press: { action: "<name>", params?: {...} } }`. Anything you put in `params` arrives in the `ui_action` `payload`.

Render every decision and choice as Buttons. For multiple-choice, emit one
Button per option, each with its own `action` (or a shared `action` plus a
distinguishing `params`).

**Table shape:**
```json
{
  "type": "Table",
  "props": {
    "columns": ["Item", "Category", "Value"],
    "rows": [
      ["Alpha", "Finance", "4,200"],
      ["Beta", "Logistics", "1,850"]
    ]
  }
}
```

**Choice via buttons + params:**
```json
{
  "type": "ui",
  "spec": {
    "root": "wrap",
    "elements": {
      "wrap": {
        "type": "Stack",
        "props": { "direction": "vertical", "gap": "sm" },
        "children": ["opt-staging", "opt-prod"]
      },
      "opt-staging": {
        "type": "Button",
        "props": { "label": "Deploy to staging", "intent": "confirm" },
        "on": { "press": { "action": "deploy", "params": { "env": "staging" } } }
      },
      "opt-prod": {
        "type": "Button",
        "props": { "label": "Deploy to production", "intent": "destructive" },
        "on": { "press": { "action": "deploy", "params": { "env": "prod" } } }
      }
    }
  }
}
```
The tap arrives as `{ "ui_action": "deploy", "payload": { "env": "prod" }, "session_id": "..." }`.
