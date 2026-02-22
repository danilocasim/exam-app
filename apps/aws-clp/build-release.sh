#!/bin/bash

# Build Release APK for Google Play Store
# This script automates the local build process for Play Store submission

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔨 Starting Play Store Release Build${NC}"
echo ""

# Check signing credentials
if [ -z "$ANDROID_KEYSTORE_PASSWORD" ] || [ -z "$ANDROID_KEY_PASSWORD" ]; then
    echo -e "${BLUE}📝 Setting up signing credentials...${NC}"
    echo "Enter the keystore password (from keystore generation):"
    read -s ANDROID_KEYSTORE_PASSWORD
    export ANDROID_KEYSTORE_PASSWORD
    
    echo "Enter the key password:"
    read -s ANDROID_KEY_PASSWORD
    export ANDROID_KEY_PASSWORD
    
    echo ""
fi

# Check prerequisites
echo -e "${BLUE}✓ Checking prerequisites...${NC}"

if ! command -v gradle &> /dev/null && [ ! -f "android/gradlew" ]; then
    echo -e "${RED}❌ Gradle not found. Make sure you're in the mobile directory.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found.${NC}"
    exit 1
fi

if [ ! -f "android/app/release.keystore" ]; then
    echo -e "${RED}❌ Release keystore not found at android/app/release.keystore${NC}"
    echo -e "${BLUE}Run: cd android && ./generate-keystore.sh${NC}"
    exit 1
fi

# Check ANDROID_HOME
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${RED}⚠️  ANDROID_HOME not set. Attempting to set from default location...${NC}"
    if [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
        echo -e "${GREEN}✓ ANDROID_HOME set to $ANDROID_HOME${NC}"
    else
        echo -e "${RED}❌ Could not find Android SDK. Please set ANDROID_HOME manually:${NC}"
        echo "   export ANDROID_HOME=/path/to/android/sdk"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}📦 Step 1: Cleaning previous builds...${NC}"
cd android
./gradlew clean
cd ..

echo ""
echo -e "${BLUE}📦 Step 2: Prebuild Android native files...${NC}"
npx expo prebuild -p android --clean

echo ""
echo -e "${BLUE}📦 Step 3: Building release APK...${NC}"
cd android
./gradlew assembleRelease
cd ..

# Check if build was successful
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo ""
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo -e "${GREEN}APK Location: $APK_PATH${NC}"
    echo -e "${GREEN}APK Size: $APK_SIZE${NC}"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo "1. Verify signing: cd android && ./gradlew signingReport"
    echo "2. Upload to Play Store:"
    echo "   - Go to https://play.google.com/console"
    echo "   - Select your app (AWS CloudPractitioner Exam Prep)"
    echo "   - Create new release in 'Testing' or 'Production' track"
    echo "   - Upload APK/AAB file"
    echo ""
    echo "For automated uploads, use fastlane or GitHub Actions"
else
    echo -e "${RED}❌ Build failed. APK not found at $APK_PATH${NC}"
    exit 1
fi

