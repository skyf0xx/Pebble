#!/usr/bin/env bash
set -euo pipefail

# Compile mcp/src → mcp/dist using the local TypeScript install.
# Assumes `npm install` has already been run in this directory.

cd "$(dirname "$0")"

npx --no-install tsc

# Make the entry point executable so it can be invoked directly by hosts
# that exec it as a binary rather than via `node`.
if [ -f dist/index.js ]; then
  chmod +x dist/index.js
fi

echo "Built: $(pwd)/dist/index.js"
