#!/usr/bin/env bash
#
# Builds self-contained Pebble binaries for all platforms.
#
# Requires: go, node (for vite build).
# The built dist/ is embedded into each binary via //go:embed, so the
# resulting binaries have zero runtime dependencies.
#
# Output: release/pebble-<platform>
#
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ Building static app (vite)…"
npm run build

# The Hermes plugin is embedded via //go:embed all:hermes-plugin (the all:
# prefix is required to include __init__.py). That same prefix would also drag
# in any __pycache__/ bytecode, so scrub it before compiling.
echo "▸ Cleaning Python bytecode from plugin…"
find hermes-plugin -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true

mkdir -p release

# GOOS:GOARCH:output-name
targets=(
  "darwin:arm64:pebble-macos-arm64"
  "darwin:amd64:pebble-macos-x64"
  "linux:amd64:pebble-linux-x64"
  "linux:arm64:pebble-linux-arm64"
  "windows:amd64:pebble-windows-x64.exe"
)

for entry in "${targets[@]}"; do
  IFS=":" read -r goos goarch name <<< "$entry"
  out="release/${name}"
  echo "▸ Compiling ${out}…"
  GOOS="$goos" GOARCH="$goarch" CGO_ENABLED=0 \
    go build -trimpath -ldflags="-s -w" -o "$out" .
done

echo
echo "✓ Done. Binaries in release/:"
ls -lh release/
