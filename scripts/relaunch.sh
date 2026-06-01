#!/usr/bin/env bash
#
# Rebuild Pebble, stop any running launcher, and start the fresh binary.
#
# One command for the inner dev loop after changing main.go or the app:
#   npm run relaunch
#
# Builds all platform binaries (via build-binary.sh), then runs the one
# matching this machine. Honours PEBBLE_PORT (default 5173) for the kill step
# and passes any extra args straight through to the binary, e.g.:
#   npm run relaunch -- --open
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PEBBLE_PORT:-5173}"

# 1. Build the latest binaries.
bash scripts/build-binary.sh

# 2. Kill whatever currently holds the port (the old launcher, usually).
if pids="$(lsof -ti "tcp:${PORT}" 2>/dev/null)"; then
  echo "▸ Stopping process on port ${PORT} (${pids//$'\n'/, })…"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  # Give it a moment, then force any survivors.
  sleep 1
  if pids="$(lsof -ti "tcp:${PORT}" 2>/dev/null)"; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
fi

# 3. Pick the binary for this OS/arch and launch it.
case "$(uname -s)" in
  Darwin) os="macos" ;;
  Linux)  os="linux" ;;
  *)      echo "✗ Unsupported OS: $(uname -s). Run a binary from release/ manually." >&2; exit 1 ;;
esac

case "$(uname -m)" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64)  arch="x64" ;;
  *)             echo "✗ Unsupported arch: $(uname -m)." >&2; exit 1 ;;
esac

bin="release/pebble-${os}-${arch}"
if [[ ! -x "$bin" ]]; then
  echo "✗ Expected binary not found: $bin" >&2
  exit 1
fi

echo "▸ Launching ${bin}…"
exec "$bin" --port "$PORT" "$@"
