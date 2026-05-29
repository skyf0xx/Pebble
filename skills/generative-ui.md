# Pebble Generative UI — Agent Reference

How to push interactive UI into a chat thread and receive feedback from user interactions.

---

## Style guide

Pebble has a warm, minimal design language. UI blocks should feel like a natural part of the conversation — calm, not shouty. Follow these rules when composing specs.

### Colour intent

UI blocks live inside the chat thread alongside filled message bubbles. To avoid competing with them, buttons in UI blocks use a ghost style — no border, no fill, just colored text with a subtle hover tint.

Buttons declare an `intent` — the renderer picks the visual treatment. Don't think in colours.

| Intent | Use for | Style |
| --- | --- | --- |
| `confirm` | The one action the agent most wants taken | Bold blue ghost |
| `dismiss` | Soft decline, "not now", neutral choices | Muted grey ghost |
| `destructive` | Irreversible actions — delete, cancel a live operation | Red ghost |
| omitted | Equal-weight options with no clear preference | Muted grey ghost |

Never set `confirm` on more than one button in the same block. Never use `destructive` for soft dismissals.

### Tone

- Labels should be calm and human. "Yes, book it" not "CONFIRM BOOKING".
- Avoid all-caps, exclamation marks, or urgency language unless the situation genuinely calls for it.
- Prefer active, specific verbs: "Send report", "Schedule call", "Try again" — not "OK", "Submit", "Yes".
- Destructive buttons should name what's being destroyed: "Delete session" not just "Delete".

### Layout rules

- Use `Stack` with `direction: "horizontal"` and `gap: "sm"` for 2–3 action buttons.
- Use `Stack` with `direction: "vertical"` and `gap: "md"` for forms and multi-step content.
- Wrap multi-element blocks in a `Card` when the content is self-contained (a form, a summary, a decision). Skip the Card for simple 1–2 button rows — the AgentUIBlock card wrapper already provides visual separation.
- Don't nest Cards inside Cards.

### Density

- Keep blocks focused: one question or decision per block. If you need more, send a follow-up message.
- Progress and status components (`Progress`, `Alert`, `Badge`) should appear at the top of a card, before actions.
- Separators should divide clearly distinct sections — don't use them decoratively.

### What not to do

- Don't put more than 3 buttons in a single `Stack` — restructure as a `Radio` or `Select` instead.
- Don't send multi-page or browsable content — break it into follow-up messages instead.

---

## How it works

Send an `agent_ui` message over WebSocket. Pebble renders it inline in the thread as a card. When the user interacts (button press, form submit, etc.), Pebble sends back a `ui_action` message.

---

## Sending a UI spec

```json
{
  "type": "agent_ui",
  "session_id": "s-abc123",
  "message_id": "ui_1748500000000",
  "spec": { ... },
  "timestamp": "2026-05-29T12:00:00.000Z"
}
```

- `message_id` — unique ID for this UI block; use `"ui_" + Date.now()` or a UUID
- `spec` — the json-render spec (see below)
- Send after an `agent_message` to attach the UI below it, or standalone

The UI block renders as a rounded card (`rounded-2xl`) indented to align with the agent message bubble (not full-width). Keep specs compact — the card is not a full-page canvas.

---

## Receiving feedback

When the user interacts, Pebble sends:

```json
{
  "type": "ui_action",
  "session_id": "s-abc123",
  "action": "approve",
  "payload": {},
  "timestamp": "2026-05-29T12:00:01.000Z"
}
```

- `action` — the action name you wired up in the spec's `on` field
- `payload` — params passed with the action (form values, selected items, etc.)

---

## Spec format

A spec is a flat map of elements. Every element has a `type`, optional `props`, optional `children` (array of element IDs), and optional `on` (event → action binding).

```json
{
  "root": "root-element-id",
  "elements": {
    "root-element-id": {
      "type": "ComponentName",
      "props": { ... },
      "children": ["child-id-1", "child-id-2"]
    },
    "child-id-1": {
      "type": "Button",
      "props": { "label": "Click me" },
      "on": {
        "press": { "action": "my_action", "params": { "key": "value" } }
      }
    }
  }
}
```

**Action binding shape** — always use the object form, never a plain string:
```json
{ "action": "action_name", "params": { "optional": "payload" } }
```

---

## Available components

### Layout

**Stack** — flex container
```json
{
  "type": "Stack",
  "props": {
    "direction": "horizontal" | "vertical",
    "gap": "none" | "sm" | "md" | "lg" | "xl",
    "align": "start" | "center" | "end" | "stretch",
    "justify": "start" | "center" | "end" | "between" | "around"
  },
  "children": [...]
}
```

**Card** — surface with optional title/description
```json
{
  "type": "Card",
  "props": {
    "title": "Card title",
    "description": "Subtitle text",
    "maxWidth": "sm" | "md" | "lg" | "full"
  },
  "children": [...]
}
```

**Separator** — horizontal rule
```json
{ "type": "Separator", "props": { "orientation": "horizontal" | "vertical" } }
```

**Collapsible** — expand/collapse section
```json
{
  "type": "Collapsible",
  "props": { "title": "Show details", "defaultOpen": false },
  "children": [...]
}
```

---

### Display

**Heading**
```json
{ "type": "Heading", "props": { "text": "Hello", "level": "h1" | "h2" | "h3" | "h4" } }
```

**Badge**
```json
{
  "type": "Badge",
  "props": {
    "text": "New",
    "variant": "default" | "secondary" | "destructive" | "outline"
  }
}
```

**Alert**
```json
{
  "type": "Alert",
  "props": {
    "title": "Heads up",
    "message": "Something to note.",
    "type": "info" | "success" | "warning" | "error"
  }
}
```

**Progress**
```json
{ "type": "Progress", "props": { "value": 60, "max": 100, "label": "Loading..." } }
```

**Table** — static data table
```json
{
  "type": "Table",
  "props": {
    "columns": ["Name", "Status", "Date"],
    "rows": [["Alice", "Active", "2026-05-01"], ["Bob", "Done", "2026-04-28"]],
    "caption": "Optional caption"
  }
}
```

**Avatar**
```json
{ "type": "Avatar", "props": { "src": "https://...", "name": "Alice", "size": "sm" | "md" | "lg" } }
```

**Image**
```json
{ "type": "Image", "props": { "src": "https://...", "alt": "Description", "width": 400, "height": 300 } }
```

---

### Interactive (fire `ui_action` on interaction)

**Button** — event: `press`. Use `intent` to declare purpose; the renderer picks the style.
```json
{
  "type": "Button",
  "props": {
    "label": "Confirm",
    "intent": "confirm" | "dismiss" | "destructive",
    "disabled": false
  },
  "on": { "press": { "action": "confirm" } }
}
```

**Link** — event: `press`
```json
{
  "type": "Link",
  "props": { "label": "Open docs", "href": "https://..." },
  "on": { "press": { "action": "link_clicked" } }
}
```

**Checkbox** — event: `change`
```json
{
  "type": "Checkbox",
  "props": { "label": "I agree", "name": "agree", "checked": false },
  "on": { "change": { "action": "agreement_changed" } }
}
```

**Radio** — event: `change`
```json
{
  "type": "Radio",
  "props": { "label": "Priority", "name": "priority", "options": ["Low", "Medium", "High"] },
  "on": { "change": { "action": "priority_selected" } }
}
```

---

## Examples

### Approve / Reject

```json
{
  "root": "wrap",
  "elements": {
    "wrap": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "children": ["btn-approve", "btn-reject"]
    },
    "btn-approve": {
      "type": "Button",
      "props": { "label": "Approve", "intent": "confirm" },
      "on": { "press": { "action": "approve" } }
    },
    "btn-reject": {
      "type": "Button",
      "props": { "label": "Reject", "intent": "destructive" },
      "on": { "press": { "action": "reject" } }
    }
  }
}
```

### Status card with action

```json
{
  "root": "card",
  "elements": {
    "card": {
      "type": "Card",
      "props": { "title": "Deployment status", "description": "Last updated 2 min ago" },
      "children": ["progress", "sep", "status-row"]
    },
    "progress": { "type": "Progress", "props": { "value": 80, "max": 100, "label": "Building..." } },
    "sep": { "type": "Separator", "props": { "orientation": "horizontal" } },
    "status-row": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm", "align": "center" },
      "children": ["badge", "cancel-btn"]
    },
    "badge": { "type": "Badge", "props": { "text": "In progress", "variant": "secondary" } },
    "cancel-btn": {
      "type": "Button",
      "props": { "label": "Cancel deploy", "intent": "destructive" },
      "on": { "press": { "action": "cancel_deploy" } }
    }
  }
}
```

---

## Tips

- Element IDs only need to be unique within the spec — use short readable names (`btn-ok`, `title`, `form-wrap`)
- `children` arrays must reference IDs that exist in `elements`
- All props are optional unless marked required in the component definition — omit props you don't need rather than passing `null`
- To show a UI block without a preceding text message, send `agent_ui` alone — Pebble renders it standalone
- To attach UI below a message, send `agent_message` first (final chunk, `streaming: false`), then `agent_ui` with a different `message_id`
