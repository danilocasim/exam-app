#!/bin/bash
# Build all exam apps

set -euo pipefail

for app_dir in apps/*/; do
  if [ -f "${app_dir}eas.json" ]; then
    echo "Building $(basename "$app_dir")..."
    (cd "$app_dir" && eas build --platform android --profile production --non-interactive)
  fi
done
