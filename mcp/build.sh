#!/usr/bin/env bash
set -euo pipefail

# Compile mcp/src → mcp/dist using the local TypeScript install.
# Assumes `npm install` has already been run in this directory.

cd "$(dirname "$0")"

# In containerised/offline environments npm sometimes skips devDependencies.
# Defensively ensure the type packages are present before compiling.
if [ ! -d "node_modules/@types/node" ] || [ ! -d "node_modules/@types/ws" ]; then
  echo "Re-installing missing @types packages..."
  npm install --save-dev @types/node@22 @types/ws@8
fi

npx --no-install tsc

# Make the entry point executable so it can be invoked directly by hosts
# that exec it as a binary rather than via `node`.
if [ -f dist/index.js ]; then
  chmod +x dist/index.js
fi

echo "Built: $(pwd)/dist/index.js"
