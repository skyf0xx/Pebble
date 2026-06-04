---
name: pebble-protocol-ui
description: Component catalogue for Pebble `pebble_send` type "ui" blocks — OpenUI Lang syntax, components, the action model (buttons, forms, $state), and what Pebble does NOT support. View when building an interactive UI block.
category: integrations
tags: [pebble, hermes, ui, openui-lang, components]
---

# Pebble UI component catalogue (OpenUI Lang)

Reference for building `pebble_send` type `"ui"` blocks. The protocol itself
(message/ui/status/push, the `ui_action` round-trip) lives in
`pebble:pebble-protocol` — view that first if you haven't.

A `ui` block's `spec` field is a **string** of [OpenUI Lang](https://www.openui.com/docs/openui-lang/specification-v05)
— a compact, declarative UI language. Pebble renders it with `@openuidev`'s
built-in component library (`openuiLibrary`), whose registered entry component
is **`Stack`** (so every program starts `root = Stack(...)`).

## Syntax rules (read this first)

1. Each statement is on its own line: `identifier = Expression`
2. `root` is the entry point — every program **must** define `root = Stack(...)`.
   If `root` is missing, nothing renders.
3. Expressions: strings (`"..."`), numbers, booleans, `null`, arrays (`[...]`),
   objects (`{...}`), component calls `TypeName(arg1, arg2, ...)`, built-in
   calls `@Name(args)`, member access (`data.rows.title`), ternaries
   (`$show ? a : b`), and binary ops (`"" + $n + " days"`).
4. Define a reference on one line, use it later: `title = TextContent("Hi")`.
   **Forward references are allowed** — `root = Stack([chart])` can appear
   before `chart = ...` (hoisting). Generate top-down: layout → components →
   data, so the shell streams in first.
5. Arguments are **POSITIONAL** — order matters, names don't (they map to props
   by the component's schema key order). Write `Stack([kids], "row", "l")`,
   **not** `Stack([kids], direction: "row")`. Colon/named syntax silently
   breaks. Omit trailing optional args to skip them; pass `null` to skip a
   middle one (e.g. `Button("Go", null, "primary")`).
6. Strings use double quotes with backslash escaping.
7. Your entire `spec` is Lang — no markdown fences, no prose, just statements.

## The interaction model

Interactivity comes from **buttons**, **forms**, and optional **reactive state
(`$variables`)**. Two kinds of outcome:

- **Round-trips to you** (the agent), arriving as a `ui_action` (see
  `pebble:pebble-protocol`). This is how the conversation continues.
- **Stays in the browser** — reactive `$state` updates and URL opens happen
  client-side and do *not* notify you.

### Action steps (inside `Action([...])`)

A button's second argument is an `Action([...])` — a list of steps run in order.
The steps Pebble supports:

| Step | What it does | Reaches you? |
| --- | --- | --- |
| `@ToAssistant("message")` | Send a message back to you | **Yes** — `ui_action` |
| `@OpenUrl("https://...")` | Open a URL in a new tab | No — client-side |
| `@Set($var, value)` | Set a `$variable` | No — client-side |
| `@Reset($var1, $var2, ...)` | Restore `$variables` to their declared defaults | No — client-side |

- A **Button with no explicit action auto-sends its label** to you — i.e.
  `Button("Tell me more")` behaves like
  `Button("Tell me more", Action([@ToAssistant("Tell me more")]))`. Use this for
  conversational choices.
- A **Form** collects field values; its submit button's action carries the whole
  form state. Those values arrive in the `ui_action` payload under `values`
  (keyed by field `name`).
- Encode any custom intent in the `@ToAssistant` message text / button label —
  there is no arbitrary custom-payload step.

### NOT supported in Pebble

OpenUI Lang v0.5 also defines `Query(...)`, `Mutation(...)`, and the `@Run(ref)`
action step for calling tools directly from the UI. **Pebble does not wire a
tool provider**, so these will not work — the browser has no direct tool access.
The agent (you) owns all tools: when a UI needs fresh data or a side effect,
round-trip via `@ToAssistant` (or a form submit) and act on it on your next turn,
then `push` an updated UI block. Likewise the data built-ins (`@Count`, `@Sum`,
`@Filter`, `@Each`, …) are only useful over `Query` results, so avoid them — bake
final values into the spec instead.

## Reactive state (`$variables`) — client-side only

Declare with `$name = default`. Bind a `$var` into an input to two-way-bind it;
reference it in expressions to make them re-evaluate as the user interacts. Use
this for pure client-side interactivity (toggle a section, live-preview a value)
that you don't need to know about.

```
root = Stack([toggle, details])
$open = false
toggle = Button("Details", Action([@Set($open, !$open)]), "secondary")
details = $open ? body : null
body = TextContent("Here are the details…")
```

## Buttons

- **Button** — `Button(label, action?, variant?, type?, size?)`.
  `variant`: `"primary" | "secondary" | "tertiary"`. `type`: `"normal" | "destructive"`.
  `size`: `"extra-small" | "small" | "medium" | "large"`.
  Omit `action` (or pass `null`) to auto-send the label.
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
- Inputs (note `name` is always first):
  - `Input(name, placeholder?, type?, rules?)` — `type`: `"text" | "email" | "password" | "number" | "url"`.
  - `TextArea(name, placeholder?, rows?, rules?)`.
  - `Select(name, items[], placeholder?, rules?)` with `SelectItem(value, label)`.
  - `RadioGroup(name, items[])` with `RadioItem(label, description, value)`.
  - `CheckBoxGroup(name, items[], rules?)` with `CheckBoxItem(label, description, name, defaultChecked?)`.
  - `DatePicker(name, mode?, rules?)` — `mode`: `"single" | "range"`.
  - `Slider(name, variant, min, max, step?, defaultValue?, label?, rules?)` — `variant`: `"continuous" | "discrete"`.
- `rules` is an optional object. Available keys: `required`, `email`, `url`,
  `numeric`, `min` (number), `max` (number), `minLength` (number),
  `maxLength` (number), `pattern` (regex string). E.g.
  `{ required: true, email: true, minLength: 8 }`. The renderer shows validation
  errors automatically — don't write error text.

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
  `direction`: `"row" | "column"` (default `"column"`).
  `gap`: `"none"|"xs"|"s"|"m"|"l"|"xl"|"2xl"`.
  `align`: `"start"|"center"|"end"|"stretch"|"baseline"`.
  `justify`: `"start"|"center"|"end"|"between"|"around"|"evenly"`. `wrap`: bool.
  Your default wrapper. For grids, use `direction "row"` with `wrap true`.
- **Card** — `Card(children[], variant?, direction?, gap?, align?, justify?, wrap?)`.
  `variant`: `"card"` (default) | `"sunk"` | `"clear"`. Groups related content.
- **CardHeader** — `CardHeader(title?, subtitle?)`.
- **TextContent** — `TextContent(text, size?)`. Supports markdown.
  `size`: `"small"|"default"|"large"|"small-heavy"|"large-heavy"`.
- **Callout** — `Callout(variant, title, description)`. `variant`: `"info"|"warning"|"error"|"success"|"neutral"`.
- **Separator** — `Separator(orientation?, decorative?)`. `orientation`: `"horizontal"|"vertical"`.
- **Table** (column-oriented!) — `Table(columns[])` where each is
  `Col(label, data, type?)`. `type`: `"string"|"number"|"action"`. Each Col
  holds its **own** data array — the table is built from columns, not rows.
- **Tag** — `Tag(text, icon?, size?, variant?)`. `size`: `"sm"|"md"|"lg"`,
  `variant`: `"neutral"|"info"|"success"|"warning"|"danger"`.
- **TagBlock** — `TagBlock(tags[])` — a list of plain **strings**, not Tag components.
- **Image** — `Image(alt, src?)` (note `alt` first). **ImageBlock** — `ImageBlock(src, alt?)`.
  **ImageGallery** — `ImageGallery(images[])` where each is `{ src, alt?, details? }`.
- **CodeBlock** — `CodeBlock(language, codeString)`.
- **Steps** — `Steps(items[])` with `StepsItem(title, details)`.
- **Tabs** / **Accordion** — items are `{ value, trigger, content[] }`.
- **Charts** (`BarChart`, `LineChart`, `PieChart`, …) — see the OpenUI Lang docs
  for signatures.

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
