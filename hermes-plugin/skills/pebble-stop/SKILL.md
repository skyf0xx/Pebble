---
name: pebble-stop
description: Stop a running Pebble — shut down the launcher serving the chat interface
category: integrations
tags: [pebble, hermes, stop, shutdown]
---

# Stop Pebble

The Pebble launcher serves the web app on port `5173`. To stop it, kill whatever
holds that port:

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null
```

Confirm it's down:

```bash
curl -s http://localhost:5173/health || echo "Pebble is stopped."
```

This stops **only** the Pebble launcher (the web app + `/api/*` reverse proxy).
It does **not**:

- touch the **Hermes gateway** or the API server on `8642` — those keep running,
- **remove** the installed plugin at `~/.hermes/plugins/pebble/` or the binary at
  `~/.hermes/bin/pebble`.

To start Pebble again, see the **`pebble:pebble-setup`** skill
([../pebble-setup/SKILL.md](../pebble-setup/SKILL.md)) — step 2 also frees the
port before launching, so a fresh start handles a stale process on its own.
