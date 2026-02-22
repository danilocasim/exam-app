# Release Signing Configuration

## Overview

Your app is now configured to sign releases with a **release keystore** for Google Play Store submission.

## Signing Credentials

These credentials were generated on: **February 18, 2026**

```
Keystore File: android/app/release.keystore
Keystore Password: your_keystore_password
Key Alias: android-release-key
Key Password: your_key_password
```

## Secure Storage

### ⚠️ IMPORTANT SECURITY GUIDELINES

1. **Never commit keystore to Git** - It's already in `.gitignore`
2. **Store passwords securely:**
   - Keep a secure copy in 1Password, LastPass, or similar password manager
   - Document separately from the keystore file
3. **For CI/CD (GitHub Actions):**
   - Base64 encode the keystore file:
     ```bash
     base64 -i android/app/release.keystore | pbcopy
     ```
   - Add to GitHub Secrets as `RELEASE_KEYSTORE_BASE64`
   - Store passwords as `RELEASE_KEYSTORE_PASSWORD` and `RELEASE_KEY_PASSWORD`

## Building Releases

### Option 1: Using the Build Script (Recommended)

```bash
cd mobile
./build-release.sh
```

The script will:
- Prompt for keystore password (if not in environment)
- Prompt for key password (if not in environment)
- Validate prerequisites
- Build signed release APK

### Option 2: Manual Build

```bash
cd mobile

# Set environment variables
export ANDROID_KEYSTORE_PASSWORD="your_keystore_password"
export ANDROID_KEY_PASSWORD="your_key_password"

# Build
npx expo prebuild -p android --clean
cd android
./gradlew assembleRelease
cd ..
```

### Option 3: Using gradle.properties (Less Secure)

Create `android/app/gradle.properties`:

```gradle
ANDROID_KEYSTORE_PASSWORD=your_keystore_password
ANDROID_KEY_PASSWORD=your_key_password
```

Then build normally:
```bash
npx expo prebuild -p android --clean
cd android && ./gradlew assembleRelease
```

**Note:** Don't commit this file to Git!

## Verifying Signing

After build, verify the APK is signed with the release key:

```bash
cd android
./gradlew signingReport
```

Expected output:
```
Variant: release
Config: release
Store: release.keystore
Alias: android-release-key
MD5: (hash)
SHA1: (hash)
SHA-256: (hash)
```

## Testing Signed APK

```bash
# Install to device/emulator
adb install -r android/app/build/outputs/apk/release/app-release.apk

# Launch app
adb shell am start -n com.awsccp.examprep/.MainActivity
```

## Troubleshooting

### "Could not validate APK signature"

**Cause:** Wrong password provided
**Fix:** 
1. Verify password is correct in password manager
2. Re-run build script with correct password
3. If keystore lost, regenerate (old releases won't match)

### "Could not find keystore file"

**Cause:** `release.keystore` missing from `android/app/`
**Fix:**
```bash
cd android
./generate-keystore.sh
```

### "Version code X already exists"

**Cause:** Version code not incremented
**Fix:** Update in `mobile/app.json`:
```json
{
  "expo": {
    "version": "1.0.1",  // Increment version
    ...
  }
}
```

Or in `android/app/build.gradle`:
```gradle
android {
  defaultConfig {
    versionCode 2  // Increment from 1
    ...
  }
}
```

## Play Store Upload

Once APK is built and verified as signed:

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app: **AWS CloudPractitioner Exam Prep**
3. Navigate to **Testing > Internal Testing**
4. Click **Create new release**
5. Upload `mobile/android/app/build/outputs/apk/release/app-release.apk`
6. Complete release notes and submit

## Keystore Rotation (Advanced)

If you need to rotate signing keys (requires new app listing):

1. Create a new keystore:
   ```bash
   cd android && ./generate-keystore.sh
   ```
2. Update `build.gradle` to use new keystore
3. NEW Play Console listing required (old key cannot be changed)

For long-term production, consider using **Google Play App Signing** which allows certificate rotation while maintaining app identity.

## Support

- **Build Issues:** See `quickstart.md` → Troubleshooting section
- **Play Store Issues:** See `quickstart.md` → Uploading to Google Play Store section
- **Signing Issues:** Run `./gradlew signingReport` for diagnostics
