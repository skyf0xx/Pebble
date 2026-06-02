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

## Critical: content goes in `props`, never in a child

Text content is **always a prop** on the element that shows it — `props.text`
for Heading/Text/Badge, `props.label` for Button. Do **not** create a separate
child element to hold text, and do **not** use a `content` prop or a `"text"`
element type. Those silently render empty.

```jsonc
// ✗ WRONG — text in a child element, lowercase "text" type, `content` prop
"heading":      { "type": "Heading", "children": ["heading_text"] },
"heading_text": { "type": "text", "props": { "content": "Button Collection" } }

// ✓ RIGHT — text is a prop on the element itself
"heading": { "type": "Heading", "props": { "level": "h2", "text": "Button Collection" } }
```

```jsonc
// ✗ WRONG — label in a child
"btn": { "type": "Button", "children": ["btn_text"] },
"btn_text": { "type": "text", "props": { "content": "Save" } }

// ✓ RIGHT — label is a prop, no children
"btn": { "type": "Button", "props": { "label": "Save", "intent": "confirm" },
         "on": { "press": { "action": "save" } } }
```

`children` is **only** for layout containers (Stack, Grid, Card) and holds the
ids of *other elements*, never text. Leaf components (Heading, Text, Badge,
Button, Alert) take no `children`.

## Layout & structure

- **Stack** — flex container. `props: { direction: "horizontal"|"vertical", gap: "sm"|"md"|"lg"|"xl"|"none", align?, justify? }`, `children: [...]`. `gap` is a **named size**, not a pixel number. Your default wrapper.
- **Grid** — grid layout. `props: { columns: <number>, gap: "sm"|"md"|"lg"|"xl" }`, `children: [...]`.
- **Card** — bordered container. `props: { title?, description?, maxWidth?, centered? }`, `children: [...]`. Good for grouping a block of related info.
- **Separator** — visual divider. `props: { orientation?: "horizontal"|"vertical" }`.

## Display (read-only — show information)

- **Heading** — `props: { text: <string>, level?: "h1"|"h2"|"h3"|"h4" }`. Text is the `text` prop, no children.
- **Text** — paragraph. `props: { text: <string>, variant?: "body"|"caption"|"muted"|"lead"|"code" }`. Text is the `text` prop, no children.
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

**Full spec — heading, prompt text, and choice buttons (canonical shape):**
```json
{
  "type": "ui",
  "spec": {
    "root": "wrap",
    "elements": {
      "wrap": {
        "type": "Stack",
        "props": { "direction": "vertical", "gap": "md" },
        "children": ["title", "prompt", "actions"]
      },
      "title":  { "type": "Heading", "props": { "level": "h2", "text": "Deploy" } },
      "prompt": { "type": "Text", "props": { "text": "Which environment?" } },
      "actions": {
        "type": "Stack",
        "props": { "direction": "horizontal", "gap": "sm" },
        "children": ["opt-staging", "opt-prod"]
      },
      "opt-staging": {
        "type": "Button",
        "props": { "label": "Staging", "intent": "confirm" },
        "on": { "press": { "action": "deploy", "params": { "env": "staging" } } }
      },
      "opt-prod": {
        "type": "Button",
        "props": { "label": "Production", "intent": "destructive" },
        "on": { "press": { "action": "deploy", "params": { "env": "prod" } } }
      }
    }
  }
}
```
Note: every label and heading is a `props` value; only the two `Stack`s have
`children`. The tap arrives as
`{ "ui_action": "deploy", "payload": { "env": "prod" }, "session_id": "..." }`.
