#!/usr/bin/env bash
#
# Pebble Quick Start
# 
# Installs deps, starts dev server, and prints the launch URL.
#

set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pebble — Hermes PWA Chat Interface"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo "✓ Dependencies installed"
  echo
else
  echo "✓ Dependencies already installed"
  echo
fi

# Extract API key from .env
HERMES_ENV="${HOME}/.hermes/.env"
if [ ! -f "$HERMES_ENV" ]; then
  echo "❌ Error: ~/.hermes/.env not found"
  echo "   Is Hermes installed?"
  exit 1
fi

API_KEY=*** "^API_SERVER_KEY=" "$HERMES_ENV" | cut -d'=' -f2)

if [ -z "$API_KEY" ]; then
  echo "⚠️  Warning: API_SERVER_KEY not found in ~/.hermes/.env"
  echo
  echo "   Generating a new key..."
  API_KEY=*** rand -hex 16)
  echo "API_SERVER_KEY=$API_KEY" >> "$HERMES_ENV"
  echo "   ✓ Added API_SERVER_KEY to ~/.hermes/.env"
  echo
  echo "   Restarting gateway to apply changes..."
  hermes gateway restart >/dev/null 2>&1 || true
  echo "   ✓ Gateway restarted"
  echo
fi

# Check if API server is enabled
API_ENABLED=*** "^API_SERVER_ENABLED=" "$HERMES_ENV" | cut -d'=' -f2)
if [ "$API_ENABLED" != "true" ]; then
  echo "⚠️  API server is not enabled"
  echo "   Enabling it now..."
  echo "API_SERVER_ENABLED=true" >> "$HERMES_ENV"
  echo "   Restarting gateway..."
  hermes gateway restart >/dev/null 2>&1 || true
  sleep 2
  echo "   ✓ API server enabled"
  echo
fi

# Verify API server is responding
echo "🔍 Verifying API server..."
if curl -s http://localhost:8642/health >/dev/null 2>&1; then
  echo "✓ API server is running on port 8642"
else
  echo "⚠️  API server is not responding yet"
  echo "   This might be normal if the gateway just restarted"
  echo "   If Pebble doesn't connect, run: hermes gateway status"
fi
echo

# Build the launch URL
LAUNCH_URL="http://localhost:5173/?hermes=http://localhost:8642&token=$API_KEY"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Launch URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "$LAUNCH_URL"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Start dev server in background
echo "🚀 Starting Vite dev server..."
echo
npm run dev &
DEV_PID=$!

# Give it a moment to start
sleep 2

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "1. Open the URL above in your browser"
echo "2. Start chatting with your Hermes agent"
echo "3. Press Ctrl+C to stop the dev server"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for the dev server
wait $DEV_PID
