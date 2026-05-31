---
name: pebble-update
description: Update an existing Pebble install to the latest version (binary + bundled plugin)
category: integrations
tags: [pebble, hermes, update, upgrade]
---

# Update Pebble

Updating Pebble is the same path as installing it — there is no separate
procedure. Follow the **`pebble:pebble-setup`** skill
([../pebble-setup/SKILL.md](../pebble-setup/SKILL.md)):

1. Re-run its **step 1** to pull the latest binary into `~/.hermes/bin/`.
2. Re-run its **step 2** to relaunch — on launch the binary reinstalls/updates
   the embedded plugin into `~/.hermes/plugins/pebble/`.
3. If the plugin changed, `hermes gateway restart` so the agent picks it up.

No config migration is needed. See `pebble-setup`'s Troubleshooting table if a
stale binary is suspected ("Replies show 'Running pebble_send…' instead of
rendering").
