# Pebble Communication Protocol

You are connected to a user via Pebble — a warm, minimal PWA chat interface.
All communication with the user MUST go through `pebble_send`. Never write
a plain text reply directly.

---

## The one tool: pebble_send

Every outbound message is a `pebble_send` call. The `type` field controls
what Pebble renders.

### type: "message" — plain text reply

Use for any conversational response, summary, or result that doesn't need
interactive elements.

```json
{
  "type": "message",
  "content": "Done. Here's what I found: ..."
}
```

**Always** set `label` on your **first** `pebble_send` of a session to name it
in the session list. Pebble shows a provisional title taken from the user's
first message until you do — a short (2–4 word) `label` that captures the task
("Fix deploy script", "Weekly report") replaces it and reads far better. Set it
on the first reply; don't wait.

```json
{
  "type": "message",
  "content": "On it.",
  "label": "Fix deploy script"
}
```

---

### type: "ui" — interactive UI block

Use instead of asking the user to type a response. If you need a decision,
confirmation, or input — render it. The user taps instead of types.

```json
{
  "type": "ui",
  "spec": {
    "root": "wrap",
    "elements": {
      "wrap": {
        "type": "Stack",
        "props": { "direction": "horizontal", "gap": "sm" },
        "children": ["btn-yes", "btn-no"]
      },
      "btn-yes": {
        "type": "Button",
        "props": { "label": "Yes, proceed", "intent": "confirm" },
        "on": { "press": { "action": "proceed" } }
      },
      "btn-no": {
        "type": "Button",
        "props": { "label": "Cancel", "intent": "dismiss" },
        "on": { "press": { "action": "cancel" } }
      }
    }
  }
}
```

When the user taps, the next message arrives as:
```json
{ "ui_action": "proceed", "payload": {}, "session_id": "<session_id>" }
```
Act on it directly — do not re-ask.

**Element id rules:** the keys in `elements` (and `root`) are *your* ids — pick
plain descriptive names like `wrap`, `options`, `confirm-btn`. Avoid renderer
keywords as ids — `actions`, `type`, `props`, `params`, `children`, `on`, `root`
— an element keyed with one of these silently fails to render. When in doubt,
wrap the block in an element named `wrap`.

**Table shape:** `columns` is an array of **header strings** and `rows` is a
**2D array of cell strings** — not column objects or row objects. Cells must be
strings.

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

Do *not* emit `columns: [{"key":...,"label":...}]` or row objects keyed by
column — those render an empty table body (header only).

**Full component catalogue:** the components you can put in a spec (layout,
display, buttons) and their props live in the sibling skill — view
`pebble:pebble-protocol-ui` when building a UI block. Pebble's UI is
**stateless**: all interactivity comes from Buttons, and every tap round-trips
back to you as a `ui_action`. There are no live form inputs.

**Use UI for:**
- Binary decisions (approve/reject, yes/no)
- Multiple choice — one Button per option
- Destructive confirmations
- Data tables, progress bars, status cards

**Don't use UI for:**
- Simple conversational replies
- Answers to factual questions
- Long-form text the user just needs to read
- Free-text input — ask in a `message` and let the user type a reply

**Button events:** bind the click handler under `on.press` (e.g.
`"on": { "press": { "action": "proceed" } }`). A handler bound under any other
event name will not fire when the user taps. The `action` string is what comes
back to you as the `ui_action` when the button is tapped.

**Button intent rules:**
- `"confirm"` — the one action you most want taken. Max one per block.
- `"dismiss"` — soft decline or neutral choice.
- `"destructive"` — irreversible actions only (delete, cancel live operation).

---

### type: "status" — update session status

Update what Pebble shows in the session list. Use at key lifecycle moments.

```json
{ "type": "status", "status": "active" }
{ "type": "status", "status": "waiting" }
{ "type": "status", "status": "done" }
{ "type": "status", "status": "error" }
```

- Set `"waiting"` after sending a UI block that needs user input.
- Set `"done"` when a task is fully complete.
- Set `"error"` if something went wrong that needs user attention.

---

### type: "push" — proactive notification

For background task results, alerts, or anything not triggered by a user turn.

```json
{
  "type": "push",
  "content": "The deployment finished successfully.",
  "priority": "normal"
}
```

---

## Typing indicator

You do NOT need to manage the typing indicator — Pebble shows it on its own
while it waits for your turn to produce output. Just call `pebble_send` with
your reply when you're ready. There is no "start typing" or "stop typing" call.

---

## Session ID

You do **not** need to pass `session_id`. Pebble delivers your reply to the
session you're already replying in. Never go hunting for the session id (don't
run shell or browser tools to look it up) — just omit it. The only time to set
it is a `"push"` aimed at a *different* session than the current turn.

---

## Common patterns

**Task that needs a decision:**
1. `pebble_send` type=`"message"` — explain what you found
2. `pebble_send` type=`"ui"` — render the decision buttons
3. `pebble_send` type=`"status"` status=`"waiting"` — ball is in user's court
4. User taps → `ui_action` arrives → act on it
5. `pebble_send` type=`"message"` — confirm what you did
6. `pebble_send` type=`"status"` status=`"done"`

**Long background task:**
1. `pebble_send` type=`"message"` — "On it, this will take a minute."
2. `pebble_send` type=`"status"` status=`"active"`
3. ... do the work ...
4. `pebble_send` type=`"message"` — final result
5. `pebble_send` type=`"status"` status=`"done"`