#!/bin/bash
#
# create-app.sh — Scaffold a new exam app from the template
#
# Usage:
#   ./scripts/create-app.sh --exam-type <ID> --name <NAME> --package <PACKAGE> [--color <HEX>]
#
# Example:
#   ./scripts/create-app.sh --exam-type SAA-C03 --name "Dojo Exam SAA" --package com.danilocasim.dojoexam.saac03 --color "#FF9900"
#

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# DEFAULTS
# ═══════════════════════════════════════════════════════════════════════════════
DEFAULT_COLOR="#f97316"  # Orange (matches aws-clp)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/apps/template"
APPS_DIR="$REPO_ROOT/apps"

# ═══════════════════════════════════════════════════════════════════════════════
# USAGE
# ═══════════════════════════════════════════════════════════════════════════════
usage() {
  cat <<EOF
Usage: $0 --exam-type <ID> --name <NAME> --package <PACKAGE> [--color <HEX>]

Required arguments:
  --exam-type <ID>      Exam type ID (e.g., SAA-C03, CLF-C02)
  --name <NAME>         Display name for the app (e.g., "Dojo Exam SAA")
  --package <PACKAGE>   Android package name (e.g., com.danilocasim.dojoexam.saac03)

Optional arguments:
  --color <HEX>         Primary brand color in hex (default: $DEFAULT_COLOR)
  --help                Show this help message

Example:
  $0 --exam-type SAA-C03 --name "Dojo Exam SAA" --package com.danilocasim.dojoexam.saac03 --color "#FF9900"
EOF
  exit 1
}

# ═══════════════════════════════════════════════════════════════════════════════
# PARSE ARGUMENTS
# ═══════════════════════════════════════════════════════════════════════════════
EXAM_TYPE=""
APP_NAME=""
PACKAGE_NAME=""
PRIMARY_COLOR="$DEFAULT_COLOR"

while [[ $# -gt 0 ]]; do
  case $1 in
    --exam-type)
      EXAM_TYPE="$2"
      shift 2
      ;;
    --name)
      APP_NAME="$2"
      shift 2
      ;;
    --package)
      PACKAGE_NAME="$2"
      shift 2
      ;;
    --color)
      PRIMARY_COLOR="$2"
      shift 2
      ;;
    --help)
      usage
      ;;
    *)
      echo "Error: Unknown argument: $1"
      usage
      ;;
  esac
done

# Validate required arguments
if [[ -z "$EXAM_TYPE" ]]; then
  echo "Error: --exam-type is required"
  usage
fi

if [[ -z "$APP_NAME" ]]; then
  echo "Error: --name is required"
  usage
fi

if [[ -z "$PACKAGE_NAME" ]]; then
  echo "Error: --package is required"
  usage
fi

# ═══════════════════════════════════════════════════════════════════════════════
# DERIVE VALUES
# ═══════════════════════════════════════════════════════════════════════════════
# APP_SLUG: lowercase exam type with hyphens (e.g., SAA-C03 → saa-c03)
APP_SLUG=$(echo "$EXAM_TYPE" | tr '[:upper:]' '[:lower:]')

# BUNDLE_ID: iOS bundle identifier (same as Android package for simplicity)
BUNDLE_ID="$PACKAGE_NAME"

# Target directory
TARGET_DIR="$APPS_DIR/$APP_SLUG"

echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                         Creating New Exam App                                 ║"
echo "╠═══════════════════════════════════════════════════════════════════════════════╣"
echo "║  Exam Type:     $EXAM_TYPE"
echo "║  App Name:      $APP_NAME"
echo "║  App Slug:      $APP_SLUG"
echo "║  Package:       $PACKAGE_NAME"
echo "║  Bundle ID:     $BUNDLE_ID"
echo "║  Primary Color: $PRIMARY_COLOR"
echo "║  Target:        $TARGET_DIR"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════
# Check template directory exists
if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "Error: Template directory not found: $TEMPLATE_DIR"
  echo "Run T221 first to create the template."
  exit 1
fi

# Check target directory doesn't already exist
if [[ -d "$TARGET_DIR" ]]; then
  echo "Error: Target directory already exists: $TARGET_DIR"
  echo "Remove it first if you want to recreate the app."
  exit 1
fi

# Validate hex color format
if [[ ! "$PRIMARY_COLOR" =~ ^#[0-9A-Fa-f]{6}$ ]]; then
  echo "Error: Invalid color format. Use hex format like #FF9900"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# COPY TEMPLATE
# ═══════════════════════════════════════════════════════════════════════════════
echo "📁 Copying template to $TARGET_DIR..."
mkdir -p "$TARGET_DIR"

# Copy all template files
for file in "$TEMPLATE_DIR"/*.template; do
  if [[ -f "$file" ]]; then
    # Remove .template extension
    dest_name=$(basename "$file" .template)
    cp "$file" "$TARGET_DIR/$dest_name"
  fi
done

# Copy dotfile templates (glob above doesn't match dotfiles)
if [[ -f "$TEMPLATE_DIR/.env.example.template" ]]; then
  cp "$TEMPLATE_DIR/.env.example.template" "$TARGET_DIR/.env.example"
fi
if [[ -f "$TEMPLATE_DIR/.gitignore.template" ]]; then
  cp "$TEMPLATE_DIR/.gitignore.template" "$TARGET_DIR/.gitignore"
fi

# Copy src directory
mkdir -p "$TARGET_DIR/src/config"
cp "$TEMPLATE_DIR/src/config/app.config.ts.template" "$TARGET_DIR/src/config/app.config.ts"
cp "$TEMPLATE_DIR/src/global.css.template" "$TARGET_DIR/src/global.css"

# Copy assets directory
cp -r "$TEMPLATE_DIR/assets" "$TARGET_DIR/assets"

# ═══════════════════════════════════════════════════════════════════════════════
# REPLACE TOKENS
# ═══════════════════════════════════════════════════════════════════════════════
echo "🔄 Replacing placeholder tokens..."

# Function to replace tokens in a file
replace_tokens() {
  local file="$1"
  if [[ -f "$file" ]]; then
    # Use sed with different delimiter to handle slashes in paths
    sed -i '' \
      -e "s|__APP_NAME__|$APP_NAME|g" \
      -e "s|__APP_SLUG__|$APP_SLUG|g" \
      -e "s|__PACKAGE_NAME__|$PACKAGE_NAME|g" \
      -e "s|__BUNDLE_ID__|$BUNDLE_ID|g" \
      -e "s|__EXAM_TYPE_ID__|$EXAM_TYPE|g" \
      -e "s|__PRIMARY_COLOR__|$PRIMARY_COLOR|g" \
      "$file"
  fi
}

# Replace tokens in all relevant files
replace_tokens "$TARGET_DIR/app.json"
replace_tokens "$TARGET_DIR/package.json"
replace_tokens "$TARGET_DIR/src/config/app.config.ts"
replace_tokens "$TARGET_DIR/tailwind.config.js"
replace_tokens "$TARGET_DIR/.env.example"

echo "✅ Tokens replaced successfully"

# ═══════════════════════════════════════════════════════════════════════════════
# CREATE .ENV FILE
# ═══════════════════════════════════════════════════════════════════════════════
echo "📝 Creating .env file from .env.example..."
cp "$TARGET_DIR/.env.example" "$TARGET_DIR/.env"

# ═══════════════════════════════════════════════════════════════════════════════
# INSTALL DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════════
echo "📦 Installing dependencies..."
cd "$TARGET_DIR"
npm install

# ═══════════════════════════════════════════════════════════════════════════════
# SUCCESS MESSAGE
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                           ✅ App Created Successfully!                        ║"
echo "╠═══════════════════════════════════════════════════════════════════════════════╣"
echo "║                                                                               ║"
echo "║  Next Steps:                                                                  ║"
echo "║                                                                               ║"
echo "║  1. Update app assets:                                                        ║"
echo "║     - Replace assets/icon.png (1024x1024)                                     ║"
echo "║     - Replace assets/splash-icon.png (288x288)                                ║"
echo "║     - Replace assets/adaptive-icon.png (1024x1024)                            ║"
echo "║     - Replace assets/favicon.png (48x48)                                      ║"
echo "║                                                                               ║"
echo "║  2. Add question bank:                                                        ║"
echo "║     - Create assets/questions/${EXAM_TYPE}.json with exam questions           ║"
echo "║                                                                               ║"
echo "║  3. Configure Google OAuth (if needed):                                       ║"
echo "║     - Update .env with EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID                       ║"
echo "║     - Update .env with EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID                   ║"
echo "║                                                                               ║"
echo "║  4. Configure EAS Build:                                                      ║"
echo "║     - Update eas.json with your EAS project ID                                ║"
echo "║     - Run: cd apps/$APP_SLUG && eas build:configure                           ║"
echo "║                                                                               ║"
echo "║  5. Test the app:                                                             ║"
echo "║     - cd apps/$APP_SLUG                                                       ║"
echo "║     - npx expo start                                                          ║"
echo "║                                                                               ║"
echo "║  6. Ensure exam type exists in backend:                                       ║"
echo "║     - Create exam type '$EXAM_TYPE' via Admin Portal                          ║"
echo "║     - Or seed it in the database                                              ║"
echo "║                                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
