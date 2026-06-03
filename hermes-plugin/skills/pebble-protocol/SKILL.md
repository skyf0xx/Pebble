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

The `spec` is **OpenUI Lang** source (a string), not a JSON object. Each line is
`name = Expression`; you must define `root = Stack([...])`; arguments are
positional. A Button with no explicit action auto-sends its label back to you.

```json
{
  "type": "ui",
  "spec": "root = Stack([prompt, actions])\nprompt = TextContent(\"Proceed with deploy?\", \"large-heavy\")\nactions = Buttons([yes, no])\nyes = Button(\"Yes, proceed\", null, \"primary\")\nno = Button(\"Cancel\", null, \"secondary\")"
}
```

When the user taps, the next turn arrives as a `ui_action` envelope:
```json
{ "ui_action": "Yes, proceed", "payload": { "type": "continue_conversation", "params": {} }, "session_id": "<session_id>" }
```
`ui_action` is the tapped button's label (or a form's submit message); for a
**Form**, the submitted field values arrive under `payload.values` keyed by
field `name`. Act on it directly — do not re-ask.

**Full component catalogue & syntax:** the components, Lang syntax, and Form
inputs live in the sibling skill — view `pebble:pebble-protocol-ui` when building
a UI block. Interactivity comes from **Buttons** (auto-send their label) and
**Forms** (round-trip their field values), both surfaced to you as a `ui_action`.

**Use UI for:**
- Binary decisions (approve/reject, yes/no)
- Multiple choice — one Button per option
- Destructive confirmations
- Structured input (a Form with fields)
- Data tables, status cards, charts

**Don't use UI for:**
- Simple conversational replies
- Answers to factual questions
- Long-form text the user just needs to read

**Button variants:** `Button(label, action?, variant?, type?)` — `variant` is
`"primary"` (the one action you most want taken; at most one per block),
`"secondary"` (neutral/soft choice), or `"tertiary"`. Pass `type` `"destructive"`
for irreversible actions only (delete, cancel a live operation). Omit `action`
(pass `null`) to auto-send the label back to you.

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