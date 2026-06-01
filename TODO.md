# TODO

Build order. Each task is self-contained — do one, commit, move on.

---

## 1. Richer, on-brand json-render rendering

`AgentUIBlock` ([src/components/ui/AgentUIBlock.tsx](src/components/ui/AgentUIBlock.tsx)) renders agent UI via `@json-render/shadcn`, with a custom ghost `Button` and ad-hoc `Table`/`intent` normalization. Goal: more components available to the agent, and styling that matches Pebble's flat, warm design language.

**Tasks**

- [ ] Audit which `@json-render/shadcn` components the agent can currently emit vs. the catalogue in [pebble-protocol/SKILL.md](hermes-plugin/skills/pebble-protocol/SKILL.md). List the gaps.
- [ ] Decide on and adopt a published schema from [json-render.dev/docs/schemas](https://json-render.dev/docs/schemas) so the agent has a documented contract, rather than the current implicit shadcn shape. Update `pebble-protocol/SKILL.md` to match.
- [ ] Expand the component set (candidates: list, key/value detail, progress, callout/alert, image, link). Each needs flat styling per the design tokens in [CLAUDE.md](CLAUDE.md) — no heavy borders/shadows, `rounded-lg` cards, Plus Jakarta Sans, the blue/orange palette.
- [ ] Replace the surrounding `bg-[#fdfcfb]` hardcode with a design token.
- [ ] Move the `Button`/`Table`/`intent` normalization shims out of the render path once the schema is settled, or document why they must stay (agents emit loose shapes).

**Watch out**

- Reserved element ids silently render nothing — avoid `actions`/`type`/`params` etc. as element keys (see memory: json-render reserved element ids).

---

## 2. Cross-device session persistence (mobile ↔ desktop)

Today the session list and ownership are **device-local**: `pebble_sessions` and `pebble_owned_sessions` live in `localStorage` ([src/lib/storage.ts](src/lib/storage.ts)), and message history is in this device's IndexedDB. Open Pebble on a second device and you see an empty inbox even though the agent has all the sessions. Ownership now lives server-side as a `[pebble]` title prefix (see memory), which is the lever that makes sync possible without a backend.

**Tasks**

- [ ] On `connect()`, derive the owned-session list from the agent: filter `GET /api/sessions` to titles with the `[pebble]` prefix instead of relying on local `pebble_owned_sessions`. The localStorage set becomes a cache/optimization, not the source of truth.
- [ ] Reconcile the server list with the local one on connect (adopt sessions seen on the server but missing locally; don't resurrect ones deleted server-side).
- [ ] Confirm message history backfills correctly on a fresh device via `session_history` — IndexedDB starts empty there, so the thread must hydrate from the agent.
- [ ] Verify the existing `migrateOwnedSessionIds` path still behaves once ownership is server-derived.

**Watch out**

- No backend, no accounts (CLAUDE.md). Sync must ride entirely on the agent's existing HTTP API + the title prefix.
- Deletes are permanent and immediate — make sure a second device doesn't re-add a session the first one deleted.
