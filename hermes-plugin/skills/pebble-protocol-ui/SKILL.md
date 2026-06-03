---
name: pebble-protocol-ui
description: Component catalogue for Pebble `pebble_send` type "ui" blocks — OpenUI Lang syntax, components, and the button/form interaction model. View when building an interactive UI block.
category: integrations
tags: [pebble, hermes, ui, openui-lang, components]
---

# Pebble UI component catalogue (OpenUI Lang)

Reference for building `pebble_send` type `"ui"` blocks. The protocol itself
(message/ui/status/push, the `ui_action` round-trip) lives in
`pebble:pebble-protocol` — view that first if you haven't.

A `ui` block's `spec` field is a **string** of [OpenUI Lang](https://openui.com/docs/openui-lang)
— a compact, declarative UI language. Pebble renders it with `@openuidev`'s
built-in component library. (This replaced the old json-render JSON specs; if
you remember emitting `{ "root": ..., "elements": {...} }` objects, that format
is gone — `spec` is now Lang source text.)

## Syntax rules (read this first)

1. Each statement is on its own line: `identifier = Expression`
2. `root` is the entry point — every program **must** define `root = Stack(...)`.
3. Expressions: strings (`"..."`), numbers, booleans, `null`, arrays (`[...]`),
   objects (`{...}`), or component calls `TypeName(arg1, arg2, ...)`.
4. Define a reference on one line, use it later: `title = TextContent("Hi")`.
5. **Every variable except `root` MUST be referenced** by another variable.
   Unreferenced variables are silently dropped and will NOT render. Always
   include a defined variable in its parent's children/items array.
6. Arguments are **POSITIONAL** — order matters, names don't. Write
   `Stack([kids], "row", "l")`, **not** `Stack([kids], direction: "row")`.
   Colon/named syntax silently breaks. Omit trailing optional args to skip them.
7. Strings use double quotes with backslash escaping.
8. Your entire `spec` is Lang — no markdown fences, no prose, just statements.

## The interaction model

Interactivity comes from **buttons** and **forms**, both of which round-trip
back to you as a `ui_action` (see `pebble:pebble-protocol`).

- A **Button with no explicit action auto-sends its label** to you — i.e.
  `Button("Tell me more")` behaves like `Button("Tell me more", Action([@ToAssistant("Tell me more")]))`. Use this for conversational choices.
- A **Form** collects field values; its submit button's action carries the
  whole form state. Those values arrive in the `ui_action` payload under
  `values` (keyed by field `name`).
- The only built-in action steps are `@ToAssistant("message")` (send a message
  back to you) and `@OpenUrl("https://...")` (navigate). There is no arbitrary
  custom-payload step — encode intent in the button label / message text.

## Buttons

- **Button** — `Button(label, action?, variant?, type?, size?)`.
  `variant`: `"primary" | "secondary" | "tertiary"`. `type`: `"normal" | "destructive"`.
  Omit `action` (pass `null`) to auto-send the label.
- **Buttons** — `Buttons(buttons[], direction?)` — a group; `direction` `"row"` (default) or `"column"`.

```
root = Stack([prompt, actions])
prompt = TextContent("Which environment?", "large-heavy")
actions = Buttons([staging, prod])
staging = Button("Staging", null, "secondary")
prod = Button("Production", null, "primary", "destructive")
```
Tapping "Production" sends it back to you as a `ui_action` whose `action` is the
button's human-friendly message ("Production").

## Forms (collect input)

`Form(name, buttons, fields?)` — a container. Define **each FormControl as its
own reference** (don't inline them all) for clean streaming. Never nest a Form
in a Form.

- **FormControl** — `FormControl(label, input, hint?)`.
- Inputs: `Input(name, placeholder?, type?, rules?)`, `TextArea(name, ...)`,
  `Select(name, items[], ...)` with `SelectItem(value, label)`,
  `RadioGroup(name, items[])` with `RadioItem(label, description, value)`,
  `CheckBoxGroup`, `DatePicker(name, ...)`, `Slider(name, variant, min, max, ...)`.
- `rules` is an optional object: `{ required: true, email: true, minLength: 8 }`.
  The renderer shows validation errors automatically — don't write error text.

```
root = Stack([title, form])
title = TextContent("Contact us", "large-heavy")
form = Form("contact", btns, [nameField, emailField])
nameField = FormControl("Name", Input("name", "Your name", "text", { required: true }))
emailField = FormControl("Email", Input("email", "you@example.com", "email", { required: true, email: true }))
btns = Buttons([submit])
submit = Button("Send", null, "primary")
```
On submit the field values (`name`, `email`) arrive in the `ui_action` payload's
`values`.

## Display & layout (read-only)

- **Stack** — `Stack(children[], direction?, gap?, align?, justify?, wrap?)`.
  `direction`: `"row" | "column"` (default `"column"`). `gap`: `"none"|"xs"|"s"|"m"|"l"|"xl"|"2xl"`.
  Your default wrapper. For grids, use `direction "row"` with `wrap true`.
- **Card** — `Card(children[], variant?, ...)`. `variant`: `"card"` (default) | `"sunk"` | `"clear"`. Groups related content.
- **CardHeader** — `CardHeader(title?, subtitle?)`.
- **TextContent** — `TextContent(text, size?)`. Supports markdown. `size`: `"small"|"default"|"large"|"small-heavy"|"large-heavy"`.
- **Callout** — `Callout(variant, title, description)`. `variant`: `"info"|"warning"|"error"|"success"|"neutral"`.
- **Separator** — `Separator(orientation?)`.
- **Table** (column-oriented!) — `Table(columns[])` where each is
  `Col(label, dataArray, type?)`. `type`: `"string"|"number"|"action"`. Each Col
  holds its **own** data array — the table is built from columns, not rows.
- **Tag / TagBlock**, **Image / ImageBlock / ImageGallery**, **CodeBlock(language, code)**,
  **Steps / StepsItem**, **Accordion / Tabs**, **charts** (`BarChart`, `LineChart`,
  `PieChart`, …) are also available — see the OpenUI Lang docs for signatures.

**Table example (column-oriented):**
```
root = Stack([title, tbl])
title = TextContent("Top options", "large-heavy")
tbl = Table([Col("Option", names), Col("Price/night", prices), Col("Rating", ratings, "number")])
names = ["Clearwater Beach, FL", "Siesta Key, FL", "Gulf Shores, AL"]
prices = ["$180", "$210", "$145"]
ratings = [4.7, 4.8, 4.5]
```

## Streaming tip

The renderer re-parses on every chunk and supports hoisting (use a reference
before defining it). Write `root = Stack(...)` **first** so the shell appears
immediately, then component definitions, then leaf data last — this gives a
clean top-down reveal as the block streams in.
