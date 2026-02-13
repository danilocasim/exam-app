#!/bin/bash
# Updates mobile/.env with the current machine's LAN IP address.
# Run this before starting Expo if your IP may have changed.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../mobile/.env"

# Detect LAN IP (macOS)
IP=$(ipconfig getifaddr en0 2>/dev/null)

if [ -z "$IP" ]; then
  echo "❌ Could not detect LAN IP on en0. Are you connected to WiFi?"
  exit 1
fi

echo "EXPO_PUBLIC_API_URL=http://${IP}:3000" > "$ENV_FILE"
echo "✅ Updated mobile/.env → API URL: http://${IP}:3000"
